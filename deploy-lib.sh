#!/usr/bin/env bash
# Shared helpers for deploy.sh and rollback.sh.
#
# Everything here is pure enough to test: the only outside contact is through `docker`, which
# the fixture tests in tests/deploy/ replace with a stub on PATH. The recovery scripts decide
# whether user files live or die, so their decision logic must be exercisable without a VPS.
#
# Callers must set: BACKUP_DIR, MANIFEST_FILE.

# Deploy and rollback synchronize through this absolute pathname after its directory exists.
deploy_lock_file() {
  printf '%s/.deploy.lock\n' "$(cd "$BACKUP_DIR" && pwd -P)"
}

valid_runtime_asset_segment() {
  [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] && [ "${#1}" -le 200 ]
}

valid_upload_evidence_url() {
  [[ "$1" == /uploads/* ]] || return 1
  local asset="${1#/uploads/}" directory="" filename
  filename="$asset"
  if [[ "$asset" == */* ]]; then
    directory="${asset%%/*}"
    filename="${asset#*/}"
    [[ "$directory" = "banners" || "$directory" = "hero" ]] || return 1
  fi
  valid_runtime_asset_segment "$filename" && [[ "$filename" == *.jpg || "$filename" == *.png || "$filename" == *.webp ]]
}

valid_document_evidence_url() {
  [[ "$1" == /documents/* ]] || return 1
  local asset="${1#/documents/}" category filename
  category="${asset%%/*}"
  filename="${asset#*/}"
  [[ "$asset" == */* ]] && [[ "$category" =~ ^(manual|datasheet|certificate|warranty|other)$ ]] \
    && valid_runtime_asset_segment "$filename" && [[ "$filename" == *.pdf ]]
}

require_runtime_asset_evidence() {
  if [ "${MAINTENANCE_WINDOW_CONFIRMED:-}" != "true" ]; then
    echo "ERROR: MAINTENANCE_WINDOW_CONFIRMED=true is required before deployment." >&2
    return 1
  fi
  if [ "${1:-required}" = "optional" ] && [ -z "${KNOWN_UPLOAD_URL:-}" ] && [ -z "${KNOWN_DOCUMENT_URL:-}" ]; then
    return 0
  fi
  for evidence in KNOWN_UPLOAD_URL KNOWN_DOCUMENT_URL; do
    value="${!evidence:-}"
    case "$value" in
      *'?'*|*'#'*|'') echo "ERROR: $evidence must be a same-origin asset path without query or fragment." >&2; return 1 ;;
    esac
  done
  valid_upload_evidence_url "$KNOWN_UPLOAD_URL" && valid_document_evidence_url "$KNOWN_DOCUMENT_URL" \
    || { echo "ERROR: known asset URLs do not match the runtime asset policy." >&2; return 1; }
}

# ---------------------------------------------------------------------------
# Archives
# ---------------------------------------------------------------------------

# Counts entries that are not directories. `tar -tzf` lists symlinks and `find -type f` does
# not, so both sides of every count comparison use "not a directory" to avoid a false mismatch
# aborting a restore that actually worked.
archive_entry_count() {
  tar -tzf "$1" 2>/dev/null | grep -cv '/$' || true
}

# An empty value makes `[ "$a" -ne "$b" ]` exit 2, which `if` reads as false — a guard meant to
# prove a restore worked would pass silently. Every count is run through this first.
require_number() {
  case "$1" in
    ''|*[!0-9]*)
      echo "ERROR: $2 produced a non-numeric result ('$1'); refusing to treat it as verified." >&2
      return 1
      ;;
  esac
  return 0
}

# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------
# Six tab-separated columns:
#   1 timestamp  2 last-deployed SHA  3 db dump  4 db name  5 uploads tar  6 documents tar
# "-" means that snapshot was not taken.

manifest_last_entry() {
  [ -s "$MANIFEST_FILE" ] || return 1
  tail -n 1 "$MANIFEST_FILE"
}

manifest_entry_field() {
  printf '%s' "$1" | cut -f"$2"
}

manifest_entry_columns() {
  printf '%s' "$1" | awk -F'\t' '{print NF}'
}

manifest_append() {
  local revision
  revision="$(validate_git_revision "$1")" || return 1
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$revision" "${2:--}" "${3:--}" "${4:--}" "${5:--}" \
    >> "$MANIFEST_FILE"
}

# Only the LAST entry's artifacts are exempt from pruning, because rollback.sh restores only
# `tail -n 1`. Exempting the whole append-only manifest would exempt every artifact ever
# written: retention would prune nothing and the upload tarballs would grow without bound,
# which is the disk-full failure retention exists to prevent.
manifest_referenced_files() {
  local entry
  if entry="$(manifest_last_entry)"; then
    printf '%s' "$entry" | cut -f3,5,6 | tr '\t' '\n' | grep -v '^-\?$' || true
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Durability and input primitives
# ---------------------------------------------------------------------------
# Two building blocks the provenance and recovery state built on top of this will depend on: a
# write that cannot be observed half-finished, and a gate every revision must pass before it is
# allowed near a destructive command. Both are self-contained and are contracted directly by
# tests/deploy/revision-validation.sh.

# rename(2) within one directory is atomic, so a reader either sees the whole old content or the
# whole new content. A bare `printf > file` truncates first: a crash in that window leaves an
# empty provenance file, which the caller would read as "no previous deploy".
atomic_write_file() {
  local target="$1" content="$2" tmp
  tmp="$(mktemp "${target}.tmp.XXXXXX")" || return 1
  printf '%s\n' "$content" > "$tmp" || { rm -f "$tmp"; return 1; }
  mv -f "$tmp" "$target"
}

# Revisions reach `git reset --hard`, recovery points, and persisted recovery commands. They come
# from files under backups/ — a directory that survives incidents, is writable by whatever went
# wrong, and is never itself part of the verified working tree. So a revision is a hostile input
# until proven otherwise, and nothing may interpolate one that has not been through here.
#
# Rejected: empty, whitespace, anything that would be parsed as an option, any shell
# metacharacter, and syntactically plausible object ids this repository does not contain.
# Prints the resolved commit id on success.
validate_git_revision() {
  local revision="${1-}" resolved
  case "$revision" in
    '' | -*) return 1 ;;
    # Whitespace, ';', '$', backticks, quotes and newlines all fall out of this class.
    *[!0-9A-Za-z/._-]*) return 1 ;;
  esac
  # `--end-of-options` stops git from reinterpreting the value even if the class above is ever
  # loosened; `^{commit}` refuses a tag or tree that merely resolves.
  resolved="$(git rev-parse --verify --quiet --end-of-options "${revision}^{commit}" 2>/dev/null)" || return 1
  [ -n "$resolved" ] || return 1
  printf '%s\n' "$resolved"
}

# ---------------------------------------------------------------------------
# Deployment provenance
# ---------------------------------------------------------------------------
# Three files, each with one job:
#
#   last-deployed-sha    CURRENT provenance — the revision believed to be running successfully.
#                        deploy.sh reads it as the next rollback target; rollback.sh must move it
#                        to the RESTORED revision or the next deploy binds fresh snapshots to the
#                        incident SHA it just rolled away from.
#   rollback-manifest    the rollback points still available. rollback.sh consumes `tail -n 1`.
#   deployment-history   append-only, never rewritten. The incident revision stays visible here
#                        after its manifest entry is consumed, so a post-mortem can still see it.
#
# Moving between those three is not a single write, so it goes through a write-ahead journal:
# provenance_journal_begin records the INTENDED end state, provenance_journal_apply reaches it,
# and only then is the journal removed. Every apply step is idempotent, so an interruption at any
# point is repaired by replaying the same journal rather than by guessing what got through.

provenance_journal_file()   { printf '%s/provenance.journal\n' "$BACKUP_DIR"; }
rollback_intent_file()      { printf '%s/rollback-intent.journal\n' "$BACKUP_DIR"; }
deploy_intent_file()        { printf '%s/deploy-intent.journal\n' "$BACKUP_DIR"; }
deployment_history_file()   { printf '%s/deployment-history\n' "$BACKUP_DIR"; }
last_deployed_sha_file()    { printf '%s/last-deployed-sha\n' "$BACKUP_DIR"; }

record_last_deployed_sha() {
  local revision
  revision="$(validate_git_revision "$1")" || return 1
  atomic_write_file "$(last_deployed_sha_file)" "$revision"
}

read_last_deployed_sha() {
  local file revision
  file="$(last_deployed_sha_file)"
  [ -s "$file" ] || return 1
  revision="$(tr -d '\r\n' < "$file")"
  validate_git_revision "$revision"
}

# Append-only. Tab-separated: 1 timestamp  2 event  3 sha  4 previous sha  5 detail.
history_append() {
  local line
  line="$(printf '%s\t%s\t%s\t%s\t%s' "$1" "$2" "$3" "${4:--}" "${5:--}")"
  # Replaying a journal must not double-write the incident record.
  if [ -f "$(deployment_history_file)" ] && grep -Fxq "$line" "$(deployment_history_file)"; then
    return 0
  fi
  printf '%s\n' "$line" >> "$(deployment_history_file)"
}

# The consumed manifest entry is carried through the journal base64-encoded: it contains tabs of
# its own, and the journal is itself tab-separated.
provenance_encode() { printf '%s' "$1" | base64 | tr -d '\n'; }
provenance_decode() { printf '%s' "$1" | base64 -d; }

provenance_journal_pending() {
  [ -s "$(provenance_journal_file)" ]
}

# A rollback intent is written by rollback.sh before its first destructive transition. Applying a
# provenance journal is what proves the rollback reached a verified end state, so clearing the
# intent belongs here. rollback.sh brings the writer and the readers that fail closed on it.
rollback_intent_clear() { rm -f "$(rollback_intent_file)"; }

# A deploy can apply migrations before it publishes a new successful SHA.  Keep the rollback
# point it was born with until success: retrying by taking a new snapshot would bind old code to
# already-migrated state.  Operators must roll back that original point or investigate first.
deploy_intent_pending() { [ -s "$(deploy_intent_file)" ]; }
deploy_intent_begin() {
  atomic_write_file "$(deploy_intent_file)" "$(printf '%s\t%s\t%s' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$(provenance_encode "${2:-}")")"
}
deploy_intent_clear() { rm -f "$(deploy_intent_file)"; }
deploy_intent_rollback_entry() {
  local encoded
  encoded="$(tail -n 1 "$(deploy_intent_file)" | cut -f3)"
  [ -n "$encoded" ] && provenance_decode "$encoded"
}

# A deploy intent is only resolved by the rollback point it was created with.  In particular,
# a later manifest entry, a first-deploy empty entry, or a recovery to the incident revision must
# leave it active: clearing any of those would let a subsequent deploy snapshot migrated state as
# though it belonged to the pre-migration revision.
deploy_intent_matches_rollback() {
  local expected_entry="$1" incident_sha="$2" target_sha actual_entry
  deploy_intent_pending || return 1
  target_sha="$(tail -n 1 "$(deploy_intent_file)" | cut -f2)"
  actual_entry="$(deploy_intent_rollback_entry)"
  [ "$target_sha" = "$incident_sha" ] && [ -n "$expected_entry" ] && [ "$actual_entry" = "$expected_entry" ]
}

# Archive the resolution before clearing the active intent. history_append is idempotent, so a
# replay after an interruption cannot erase the incident or create a duplicate record.
deploy_intent_resolve_if_exact_rollback() {
  local expected_entry="$1" incident_sha="$2" restored_sha="$3" timestamp="$4"
  deploy_intent_matches_rollback "$expected_entry" "$incident_sha" || return 0
  history_append "$timestamp" deploy-intent-resolved "$restored_sha" "$incident_sha" "exact pre-migration rollback point restored" || return 1
  deploy_intent_clear
}

# $1 restored sha  $2 incident sha  $3 the manifest entry being consumed (may be empty)
provenance_journal_begin() {
  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  atomic_write_file "$(provenance_journal_file)" \
    "$(printf '%s\t%s\t%s\t%s' "$ts" "$1" "$2" "$(provenance_encode "${3:-}")")"
}

# Drops the last manifest line, but only while it is still the entry the journal claimed. On a
# replay where the rotation already landed, the tail no longer matches and this is a no-op —
# which is what keeps the whole apply repeatable.
manifest_drop_last_entry_if() {
  local expected="$1" tmp
  [ -n "$expected" ] || return 0
  [ -s "$MANIFEST_FILE" ] || return 0
  [ "$(tail -n 1 "$MANIFEST_FILE")" = "$expected" ] || return 0

  tmp="$(mktemp "${MANIFEST_FILE}.tmp.XXXXXX")" || return 1
  # `head -n -1` on a single-line file correctly yields an empty manifest.
  head -n -1 "$MANIFEST_FILE" > "$tmp" || { rm -f "$tmp"; return 1; }
  mv -f "$tmp" "$MANIFEST_FILE"
}

# Reaches the state the journal describes, then clears it. Safe to call repeatedly and safe to
# call when no journal exists.
provenance_journal_apply() {
  local journal entry ts restored incident consumed_b64 consumed
  journal="$(provenance_journal_file)"
  [ -s "$journal" ] || return 0

  entry="$(tail -n 1 "$journal")"
  ts="$(printf '%s' "$entry" | cut -f1)"
  restored="$(printf '%s' "$entry" | cut -f2)"
  incident="$(printf '%s' "$entry" | cut -f3)"
  consumed_b64="$(printf '%s' "$entry" | cut -f4)"

  if [ -z "$ts" ] || [ -z "$restored" ]; then
    echo "ERROR: provenance journal is malformed and cannot be applied: $journal" >&2
    return 1
  fi
  restored="$(validate_git_revision "$restored")" || { echo "ERROR: provenance journal restored revision cannot be verified." >&2; return 1; }
  incident="$(validate_git_revision "$incident")" || { echo "ERROR: provenance journal incident revision cannot be verified." >&2; return 1; }

  consumed=""
  [ -n "$consumed_b64" ] && consumed="$(provenance_decode "$consumed_b64")"

  # Order is deliberate. Publishing the restored SHA first means an interruption before the
  # rotation leaves a manifest entry that would simply be consumed again — the same restore, no
  # data bound to the wrong revision. Rotating first would leave the incident SHA published with
  # no rollback point, which is the failure this whole unit exists to prevent.
  record_last_deployed_sha "$restored" || return 1
  history_append "$ts" rollback "$restored" "$incident" "rolled back to restored revision" || return 1
  manifest_drop_last_entry_if "$consumed" || return 1
  deploy_intent_resolve_if_exact_rollback "$consumed" "$incident" "$restored" "$ts" || return 1

  rm -f "$journal"
  rollback_intent_clear
}

# ---------------------------------------------------------------------------
# Retention
# ---------------------------------------------------------------------------

prune_backups() {
  local pattern="$1" kept=0 file referenced
  referenced="$(manifest_referenced_files)"
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if printf '%s\n' "$referenced" | grep -Fxq "$file"; then
      continue
    fi
    kept=$((kept + 1))
    if [ "$kept" -gt "$BACKUP_RETENTION" ]; then
      rm -f "$file"
      echo "    Pruned old backup: $(basename "$file")"
    fi
  done < <(find "$BACKUP_DIR" -maxdepth 1 -name "$pattern" -printf '%T@ %p\n' 2>/dev/null \
             | sort -rn | cut -d' ' -f2-)
  return 0
}

# ---------------------------------------------------------------------------
# Decisions
# ---------------------------------------------------------------------------
# Kept as pure functions so the branch logic itself is testable. The deploy script must never
# infer a one-time documents migration from an empty volume or an old archive. If documents are
# still only on a legacy container writable layer, deploy aborts and points to the manual runbook.

# archive_running | archive_volumes | abort_stopped_legacy | abort_legacy_unknown
#   $1 web state (running|stopped|absent)
#   $2 documents are legacy (1 = on the container's writable layer, no volume mount)
#   $3 manifest is non-empty (1 = this box has deployed before)
file_backup_plan() {
  case "$1" in
    running)
      echo "archive_running"
      ;;
    stopped)
      # A stopped legacy container may hold documents on its writable layer, but they cannot be
      # inspected or archived safely while stopped. Fail closed instead of guessing.
      if [ "$2" -eq 1 ]; then
        echo "abort_stopped_legacy"
      else
        echo "archive_volumes"
      fi
      ;;
    absent)
      # If this box has deployed before and the old container is gone, the script cannot prove
      # whether legacy writable-layer documents existed. Abort rather than pretending an empty
      # new volume or old archive is evidence.
      if [ "$3" -eq 1 ]; then
        echo "abort_legacy_unknown"
      else
        echo "archive_volumes"
      fi
      ;;
    *)
      echo "abort_unknown"
      ;;
  esac
}

# This deliberately does not inspect PostgreSQL. The official image creates POSTGRES_DB during
# its first start, so DB existence observed after `compose up db` cannot distinguish a fresh
# install from a prior deployment. Capture this state before starting the database.
deployment_state() {
  local has_last_deployed_sha="$1" web_state="$2" manifest_nonempty="$3"
  if [ "$has_last_deployed_sha" -eq 1 ] || [ "$web_state" != "absent" ] || [ "$manifest_nonempty" -eq 1 ]; then
    echo "existing"
  else
    echo "first"
  fi
}

# ---------------------------------------------------------------------------
# Container introspection
# ---------------------------------------------------------------------------

# running | stopped | absent. `docker compose ps -q` lists RUNNING containers only, so a
# stopped container looks identical to no container at all unless -a is used — and a stopped
# container may still own a writable layer holding legacy documents.
web_container_state() {
  local service="$1" all_ids running_ids
  all_ids="$(docker compose ps -aq "$service" 2>/dev/null)" || return 1
  if [ -z "$all_ids" ]; then
    echo "absent"
    return 0
  fi
  running_ids="$(docker compose ps -q "$service" 2>/dev/null)" || return 1
  if [ -n "$running_ids" ]; then
    echo "running"
  else
    echo "stopped"
  fi
  return 0
}

web_container_id() {
  docker compose ps -aq "$1" 2>/dev/null | head -1
}

# Whether a container has a volume mounted at the given destination. This is how "are the
# documents already persistent?" is answered — never by assuming, because the answer decides
# whether a rebuild is about to destroy them.
container_has_mount() {
  local container_id="$1" destination="$2"
  docker inspect -f '{{range .Mounts}}{{println .Destination}}{{end}}' "$container_id" 2>/dev/null \
    | grep -Fxq "$destination"
}

# ---------------------------------------------------------------------------
# Compose introspection at a given commit
# ---------------------------------------------------------------------------

# Anchored on the mount line itself. An unanchored `grep documents-data` also matches the
# explanatory comment in compose.yaml, so a commit that dropped the volume but kept the comment
# would pass the very check meant to catch it.
commit_mounts_volume() {
  local sha="$1" mount_line="$2"
  git show "${sha}:compose.yaml" 2>/dev/null \
    | grep -qE "^[[:space:]]+-[[:space:]]+${mount_line}[[:space:]]*$"
}

commit_mounts_runtime_volume() {
  local sha="$1" volume="$2" kind="$3"
  commit_mounts_volume "$sha" "$volume:/app/public/$kind" || commit_mounts_volume "$sha" "$volume:/app/data/$kind"
}
