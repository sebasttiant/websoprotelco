#!/usr/bin/env bash
# A failed migration must leave the original pre-migration rollback point authoritative.
#
# The revisions here are real commits in a throwaway repository, not placeholder strings.
# manifest_append, record_last_deployed_sha and provenance_journal_apply all run their input
# through validate_git_revision, so a literal like "old-successful-sha" is rejected before any
# of the behaviour below can be reached.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

BACKUP_DIR="$WORK/backups"
MANIFEST_FILE="$BACKUP_DIR/rollback-manifest"
mkdir -p "$BACKUP_DIR"
# shellcheck source=../../deploy-lib.sh
. "$HERE/deploy-lib.sh"

# validate_git_revision resolves against the current working directory, so the provenance calls
# below have to run inside the repository whose commits they name.
REPO="$WORK/repo"
mkdir -p "$REPO"
git -C "$REPO" init -q -b main
git -C "$REPO" config user.email migration-intent@example.test
git -C "$REPO" config user.name 'Migration Intent Contract'
commit_revision() {
  printf '%s\n' "$1" > "$REPO/state.txt"
  git -C "$REPO" add -A
  git -C "$REPO" commit -qm "$1"
  git -C "$REPO" rev-parse HEAD
}
old_sha="$(commit_revision 'old successful release')"
new_sha="$(commit_revision 'new release whose migration fails')"
other_sha="$(commit_revision 'an unrelated recovery target')"
cd "$REPO"

old_db="$BACKUP_DIR/db-before-migration.dump"
old_uploads="$BACKUP_DIR/uploads-before-migration.tar.gz"
old_documents="$BACKUP_DIR/documents-before-migration.tar.gz"
printf 'old database\n' > "$old_db"
mkdir "$WORK/uploads" "$WORK/documents"
printf 'old upload\n' > "$WORK/uploads/old.webp"
printf 'old document\n' > "$WORK/documents/old.pdf"
tar -czf "$old_uploads" -C "$WORK/uploads" .
tar -czf "$old_documents" -C "$WORK/documents" .
manifest_append "$old_sha" "$old_db" appdb "$old_uploads" "$old_documents"
original_entry="$(manifest_last_entry)"

# This is exactly the write deploy.sh makes immediately before invoking migrate. Simulate the
# migration changing state and failing: a retry must be rejected rather than snapshotting it.
deploy_intent_begin "$new_sha" "$original_entry"
printf 'migrated database that must not be snapshotted as old\n' > "$BACKUP_DIR/db-after-migration.dump"

if ! deploy_intent_pending; then
  echo 'FAIL: migration failure did not leave a pending deploy intent'
  exit 1
fi
if [ "$(deploy_intent_rollback_entry)" != "$original_entry" ]; then
  echo 'FAIL: retry provenance did not retain the original pre-migration rollback entry'
  exit 1
fi
if [ "$(manifest_last_entry)" != "$original_entry" ]; then
  echo 'FAIL: rollback would not use the original pre-migration database and assets'
  exit 1
fi
echo 'ok — migration failure retry fails closed with the original old-code/old-state rollback point'

# A verified rollback to the exact entry archives resolution before it clears the active intent.
provenance_journal_begin "$old_sha" "$new_sha" "$original_entry"
provenance_journal_apply
if deploy_intent_pending; then
  echo 'FAIL: exact successful rollback did not resolve deploy intent'
  exit 1
fi
if ! grep -q $'deploy-intent-resolved\t' "$(deployment_history_file)"; then
  echo 'FAIL: exact successful rollback did not preserve immutable deploy-intent history'
  exit 1
fi
if [ "$(read_last_deployed_sha)" != "$old_sha" ]; then
  echo 'FAIL: applying the journal did not publish the restored revision'
  exit 1
fi
echo 'ok — exact successful rollback resolves the active intent and retains incident history'

# The journal is a write-ahead record, so applying the same one twice must reach the same state
# rather than rotating a second manifest entry or duplicating the history line. This is the
# property that lets an interrupted transition be repaired by replay instead of by guesswork.
history_before="$(wc -l < "$(deployment_history_file)")"
manifest_before="$(wc -l < "$MANIFEST_FILE" 2>/dev/null || printf '0')"
provenance_journal_begin "$old_sha" "$new_sha" "$original_entry"
provenance_journal_apply
provenance_journal_apply
if [ "$(wc -l < "$(deployment_history_file)")" -ne "$history_before" ] \
  || [ "$(wc -l < "$MANIFEST_FILE" 2>/dev/null || printf '0')" -ne "$manifest_before" ]; then
  echo 'FAIL: replaying the provenance journal was not idempotent'
  exit 1
fi
echo 'ok — replaying the provenance journal reaches the same state instead of compounding it'

# A different rollback point is never allowed to clear the intent, even if its provenance
# transition otherwise completes. This models a partial/manual/mismatched recovery.
manifest_append "$old_sha" "$old_db" appdb "$old_uploads" "$old_documents"
original_entry="$(manifest_last_entry)"
deploy_intent_begin "$new_sha" "$original_entry"
wrong_entry="$(printf '%s' "$original_entry" | sed "s/$old_sha/$other_sha/")"
provenance_journal_begin "$other_sha" "$new_sha" "$wrong_entry"
provenance_journal_apply
if ! deploy_intent_pending; then
  echo 'FAIL: mismatched rollback cleared deploy intent'
  exit 1
fi
echo 'ok — failed or mismatched rollback preserves the fail-closed deploy intent'

# A revision that cannot be verified must never enter the manifest in the first place: the
# manifest is what rollback.sh consumes, so an unverifiable entry there is a rollback target
# nobody can check.
if manifest_append 'not-a-real-revision' "$old_db" appdb "$old_uploads" "$old_documents" 2>/dev/null; then
  echo 'FAIL: an unverifiable revision was written to the rollback manifest'
  exit 1
fi
echo 'ok — an unverifiable revision is refused before it becomes a rollback point'
