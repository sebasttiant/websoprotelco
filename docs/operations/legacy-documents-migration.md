# Legacy Documents One-Time Migration Runbook

Use this only when `deploy.sh` aborts because `/app/public/documents` still lives in the
current `web` container writable layer instead of the `documents-data` volume. The migration is
manual by design: deploy never infers intent from an empty volume and never selects an old
archive automatically.

## Safety Contract

- Writes and external traffic MUST be stopped before capture starts.
- Do NOT restart an externally reachable legacy `web` service just to read its writable layer.
- The new web container MUST NOT accept traffic before documents are restored and verified.
- Evidence MUST compare source and destination manifests, not only file counts.

## Procedure

1. Block ingress and stop the web service intentionally.

   Use the site's real ingress command first (nginx, Caddy, reverse proxy, firewall, or load
   balancer). Then stop the app container:

   ```bash
   # Example only; use the actual ingress service on the VPS.
   sudo systemctl stop nginx || true
   docker compose stop web
   ```

2. Capture files from the stopped legacy container without starting it.

   `docker cp` can read a stopped container. The copy keeps symlinks as symlinks; do not use
   `-L` because following symlinks would change the evidence.

   ```bash
   set -Eeuo pipefail
   mkdir -p backups/manual-documents-migration
   stamp="$(date -u +%Y%m%dT%H%M%SZ)"
   work="backups/manual-documents-migration/${stamp}"
   mkdir -p "$work"

   legacy_container="$(docker compose ps -aq web | head -1)"
   test -n "$legacy_container"
   docker cp "${legacy_container}:/app/public/documents/." "$work/source-documents"
   ```

3. Create source evidence and a validated archive.

   Regular files are recorded as `FILE<TAB>relative-path<TAB>sha256`. Symlinks are recorded as
   `SYMLINK<TAB>relative-path<TAB>target` and must be reviewed explicitly; if symlinks are not
   expected, abort and investigate before continuing. This uses POSIX `sh` syntax only. It
   handles spaces and non-ASCII paths; it aborts on tab/newline in names because a tab-separated
   manifest cannot represent those safely.

   ```bash
   source_dir="$work/source-documents"
   source_manifest="$work/source-manifest.tsv"
   archive="$work/legacy-documents.tar.gz"

   make_manifest() {
     dir="$1"
     out="$2"
     tmp="${out}.unsorted"
     rm -f "$tmp" "$out"
     (
       cd "$dir"
       find . \( -type f -o -type l \) -exec sh -c '
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
       ' sh {} +
     ) > "$tmp"
     LC_ALL=C sort "$tmp" > "$out"
     rm -f "$tmp"
   }

   make_manifest "$source_dir" "$source_manifest"

   tar -czf "$archive" -C "$source_dir" .
   tar -tzf "$archive" >/dev/null
   sha256sum "$archive" | tee "$work/archive.sha256"
   wc -c "$archive" | tee "$work/archive.bytes"
   ```

4. Prepare the new `documents-data` volume without serving traffic.

   Do not run `docker compose up -d web` yet. Use a one-shot container so the volume is mounted
   but the web server is not listening for users.

   ```bash
   docker compose build web
   docker compose run --rm --no-deps -T --entrypoint sh web \
     -c 'mkdir -p /app/public/documents && find /app/public/documents -mindepth 1 -delete && tar -xzf - -C /app/public/documents' \
     < "$archive"
   ```

5. Compare destination evidence to source evidence before traffic resumes.

   ```bash
   destination_manifest="$work/destination-manifest.tsv"
   docker compose run --rm --no-deps -T --entrypoint sh web -c '
     set -eu
     dir=/app/public/documents
     tmp=/tmp/documents-manifest.unsorted
     out=/tmp/documents-manifest.tsv
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
     cat "$out"
   ' > "$destination_manifest"

   diff -u "$source_manifest" "$destination_manifest"
   ```

6. Start the web service and then restore ingress.

   ```bash
   docker compose up -d --no-deps web
   docker compose ps web
   docker compose logs --tail=80 web
   sudo systemctl start nginx || true
   ```

7. Save the evidence directory path in the deployment notes:

   ```bash
   printf 'manual legacy documents migration evidence: %s\n' "$work"
   ```

## Abort / Recovery

- If ingress cannot be blocked, STOP. Do not run this migration while users can write.
- If `docker cp` fails, keep `web` stopped and investigate the stopped container ID; do not run
  `deploy.sh` yet.
- If archive validation fails, discard only the invalid archive, keep the copied source tree,
  and recreate the archive from `source-documents`.
- If restore fails, do not start `web`; fix the mount/ownership problem and rerun step 4 with
  the same validated archive.
- If source/destination manifests differ, do not start `web`; wipe the destination volume via
  the one-shot container and restore the same archive again. If symlinks differ, inspect them
  manually before deciding whether they are safe.
- If `web` starts but health checks fail, keep ingress stopped, inspect logs, and either fix the
  container or stop it again. The validated archive and source copy remain under `$work`.
