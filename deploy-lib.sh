#!/usr/bin/env bash
# Shared helpers for deploy.sh and rollback.sh.
#
# Everything here is pure enough to test: the only outside contact is through `docker`, which
# the fixture tests in tests/deploy/ replace with a stub on PATH. The recovery scripts decide
# whether user files live or die, so their decision logic must be exercisable without a VPS.
#
# Callers must set: BACKUP_DIR, MANIFEST_FILE.

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
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "${2:--}" "${3:--}" "${4:--}" "${5:--}" \
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
