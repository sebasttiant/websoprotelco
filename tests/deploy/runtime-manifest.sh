#!/usr/bin/env bash
# Probe the POSIX sh manifest logic against the runtime base image shell.
set -uo pipefail

pass=0; fail=0
ok()  { echo "  ok   — $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL — $1"; fail=$((fail + 1)); }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/src/nested dir"
printf 'alpha' > "$WORK/src/nested dir/space name á.pdf"
printf 'beta' > "$WORK/src/normal.txt"
ln -s "nested dir/space name á.pdf" "$WORK/src/link to á.pdf"

docker run --rm -v "$WORK/src:/docs:ro" -v "$WORK:/out" node:24.18.0-trixie-slim sh -eu -c '
  dir=/docs
  tmp=/out/manifest.unsorted
  out=/out/manifest.tsv
  rm -f "$tmp" "$out"
  (
    cd "$dir"
    find . \( -type f -o -type l \) -exec sh -c '\''
      for path do
        rel=${path#./}
        line_count=$(printf "%s\n" "$rel" | wc -l | tr -d " ") || exit 1
        case "$rel" in
          *"$(printf "\t")"*)
            printf "unsupported path for TSV manifest: %s\n" "$rel" >&2
            exit 64
            ;;
        esac
        if [ "$line_count" -ne 1 ]; then
          printf "unsupported newline in path for TSV manifest\n" >&2
          exit 64
        fi
        if [ -L "$path" ]; then
          target=$(readlink "$path") || exit 1
          printf "SYMLINK\t%s\t%s\n" "$rel" "$target"
        else
          sha=$(sha256sum "$path" | awk "{print \$1}") || exit 1
          test -n "$sha" || exit 1
          printf "FILE\t%s\t%s\n" "$rel" "$sha"
        fi
      done
    '\'' sh {} +
  ) > "$tmp"
  LC_ALL=C sort "$tmp" > "$out"
'

expected_space_sha="$(sha256sum "$WORK/src/nested dir/space name á.pdf" | awk '{print $1}')"
expected_normal_sha="$(sha256sum "$WORK/src/normal.txt" | awk '{print $1}')"

if grep -Fxq "FILE	nested dir/space name á.pdf	$expected_space_sha" "$WORK/manifest.tsv"; then
  ok "runtime sh manifest records path with spaces/non-ASCII and SHA-256"
else
  bad "missing file with spaces/non-ASCII from runtime manifest"
  sed 's/^/    /' "$WORK/manifest.tsv"
fi

if grep -Fxq "FILE	normal.txt	$expected_normal_sha" "$WORK/manifest.tsv"; then
  ok "runtime sh manifest records regular file SHA-256"
else
  bad "missing regular file from runtime manifest"
fi

if grep -Fxq "SYMLINK	link to á.pdf	nested dir/space name á.pdf" "$WORK/manifest.tsv"; then
  ok "runtime sh manifest records symlink target explicitly"
else
  bad "missing symlink evidence from runtime manifest"
fi

echo
echo "=================================="
echo " passed: $pass   failed: $fail"
echo "=================================="
[ "$fail" -eq 0 ]
