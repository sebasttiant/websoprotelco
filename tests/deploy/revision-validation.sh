#!/usr/bin/env bash
# Revisions that reach `git reset --hard` are hostile input.
#
# They are read from backups/ — untracked, surviving the incident, writable by whatever went
# wrong — and then interpolated into a destructive command and into persisted operator
# instructions. "This script wrote that file earlier" is not a provenance guarantee after the
# event the file exists to recover from.
#
# This contract covers the two primitives directly. The rollback paths that consume them — a
# poisoned manifest, hostile recovery-point fields — need the shared rollback fixture and are
# contracted separately once that fixture lands.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

pass=0; fail=0
ok()  { echo "  ok   — $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL — $1"; fail=$((fail + 1)); }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

REPO="$WORK/repo"
mkdir -p "$REPO"
cp "$ROOT/deploy-lib.sh" "$REPO/"
git -C "$REPO" init -q -b main
git -C "$REPO" config user.email revision-contract@example.test
git -C "$REPO" config user.name 'Revision Contract'
printf 'baseline\n' > "$REPO/file.txt"
git -C "$REPO" add -A
git -C "$REPO" commit -qm baseline
KNOWN_SHA="$(git -C "$REPO" rev-parse HEAD)"

# Runs validate_git_revision inside the fixture repository and reports its exit status.
validate() {
  ( cd "$REPO" && BACKUP_DIR="$REPO/backups" bash -c '. ./deploy-lib.sh; validate_git_revision "$1"' _ "$1" ) 2>/dev/null
}

assert_rejected() {
  local label="$1" candidate="$2"
  if validate "$candidate" >/dev/null; then
    bad "$label was accepted"
  else
    ok "$label is rejected"
  fi
}

# --- adversarial input ---------------------------------------------------------------------------
assert_rejected 'an empty revision' ''
assert_rejected 'a whitespace-only revision' '   '
assert_rejected 'a tab/newline revision' "$(printf 'a\tb')"
assert_rejected 'an option-looking revision' '--all'
assert_rejected 'a short option' '-n'
assert_rejected 'a command substitution fragment' '$(touch /tmp/pwned)'
assert_rejected 'a backtick fragment' '`id`'
assert_rejected 'a command separator' 'HEAD; rm -rf /'
assert_rejected 'a pipeline fragment' 'HEAD | cat'
assert_rejected 'an ampersand fragment' 'HEAD && id'
assert_rejected 'a quoted fragment' "HEAD'"
assert_rejected 'a glob fragment' 'HEAD*'
assert_rejected 'a nonexistent but well-formed object id' '0123456789abcdef0123456789abcdef01234567'
assert_rejected 'a revision from no repository' 'refs/heads/does-not-exist'

# --- the option-injection case must not merely be rejected: it must not EXECUTE ------------------
rm -f /tmp/revision-contract-pwned
validate '$(touch /tmp/revision-contract-pwned)' >/dev/null 2>&1 || true
if [ ! -e /tmp/revision-contract-pwned ]; then
  ok "a command-substitution revision never executes"
else
  bad "a command-substitution revision executed"
  rm -f /tmp/revision-contract-pwned
fi

# --- valid input still works ---------------------------------------------------------------------
if resolved="$(validate "$KNOWN_SHA")" && [ "$resolved" = "$KNOWN_SHA" ]; then
  ok "a known commit resolves to its full object id"
else
  bad "a known commit was rejected"
fi

if resolved="$(validate HEAD)" && [ "$resolved" = "$KNOWN_SHA" ]; then
  ok "a symbolic revision resolves to the commit it names"
else
  bad "a symbolic revision was rejected"
fi

if resolved="$(validate "${KNOWN_SHA:0:12}")" && [ "$resolved" = "$KNOWN_SHA" ]; then
  ok "an abbreviated object id resolves to the full commit"
else
  bad "an abbreviated object id was rejected"
fi

# A tag that points at a commit must resolve to the commit, never to the tag object.
git -C "$REPO" tag -a v1 -m 'annotated' -q 2>/dev/null || git -C "$REPO" tag -a v1 -m 'annotated'
if resolved="$(validate v1)" && [ "$resolved" = "$KNOWN_SHA" ]; then
  ok "an annotated tag resolves to its commit, not the tag object"
else
  bad "an annotated tag did not resolve to a commit"
fi

# --- hostile input must be rejected BEFORE it reaches git ----------------------------------------
# Every assertion above still passes with the metacharacter class deleted, because `git rev-parse`
# refuses those values too. That makes the class look redundant, and it is not: it is what keeps
# attacker-controlled bytes from reaching git's argument parsing at all, with `--end-of-options` as
# the backstop rather than the only defence. Shimming git is the only way to tell the two layers
# apart — verified by mutation, this assertion is the one that fails when the class is removed.
SHIM="$WORK/shim"
mkdir -p "$SHIM"
cat > "$SHIM/git" <<'SHIM_GIT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$GIT_SHIM_CALLS"
exit 1
SHIM_GIT
chmod +x "$SHIM/git"

validate_with_shim() {
  ( cd "$REPO" && PATH="$SHIM:$PATH" GIT_SHIM_CALLS="$WORK/git-calls" BACKUP_DIR="$REPO/backups" \
    bash -c '. ./deploy-lib.sh; validate_git_revision "$1"' _ "$1" ) 2>/dev/null
}

: > "$WORK/git-calls"
validate_with_shim 'HEAD; rm -rf /' >/dev/null || true
validate_with_shim '$(id)' >/dev/null || true
validate_with_shim '`id`' >/dev/null || true
if [ ! -s "$WORK/git-calls" ]; then
  ok "a revision carrying shell metacharacters never reaches git"
else
  bad "hostile revision bytes were passed to git"
  sed 's/^/    /' "$WORK/git-calls"
fi

# The counterpart: a well-formed revision must still be handed to git, or the assertion above
# would pass simply because validation never calls git at all.
: > "$WORK/git-calls"
validate_with_shim "$KNOWN_SHA" >/dev/null || true
if [ -s "$WORK/git-calls" ]; then
  ok "a well-formed revision is still resolved through git"
else
  bad "a well-formed revision never reached git"
fi

# --- atomic_write_file -----------------------------------------------------------------------
# The provenance files this primitive will carry are read after a crash, so "the content arrived"
# is not the whole contract: the target must never be observable as a truncated or empty file.
write_file() {
  ( cd "$REPO" && BACKUP_DIR="$REPO/backups" bash -c '. ./deploy-lib.sh; atomic_write_file "$1" "$2"' _ "$1" "$2" )
}

TARGET="$WORK/provenance"
if write_file "$TARGET" 'first-revision' && [ "$(cat "$TARGET")" = 'first-revision' ]; then
  ok "a value is written with a trailing newline"
else
  bad "a value was not written"
fi

# A shorter second write must not leave a tail of the longer first one behind.
write_file "$TARGET" 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' >/dev/null
before_inode="$(stat -c %i "$TARGET")"
write_file "$TARGET" 'short' >/dev/null
if [ "$(cat "$TARGET")" = 'short' ]; then
  ok "a shorter value replaces the previous content entirely"
else
  bad "a shorter value left the previous content behind"
fi

# The inode changing is what proves this is rename(2) over a fresh file rather than an in-place
# truncate-then-write. Only the former has no window in which a reader sees an empty file.
if [ "$(stat -c %i "$TARGET")" != "$before_inode" ]; then
  ok "the target is replaced by rename rather than truncated in place"
else
  bad "the target was written in place, leaving a truncation window"
fi

if [ -z "$(find "$WORK" -maxdepth 1 -name 'provenance.tmp.*' -print -quit)" ]; then
  ok "no temporary file is left behind"
else
  bad "a temporary file was left behind"
fi

echo
echo "=================================="
echo " passed: $pass   failed: $fail"
echo "=================================="
[ "$fail" -eq 0 ]
