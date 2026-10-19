# Runtime Asset Cutover

The candidate keeps `uploads-data` and `documents-data`; only their mount destinations change
from the previous image's `/app/public/uploads|documents` to `/app/data/uploads|documents`.
No asset or database value is copied or rewritten.

Before deploying, inventory and back up the named volumes by identity and isolate traffic. For an
existing cutover, the operator provides these inputs; `deploy.sh` rejects missing, false,
query-bearing, or policy-invalid evidence before migrations or container recreation:

```sh
MAINTENANCE_WINDOW_CONFIRMED=true \
KNOWN_UPLOAD_URL=/uploads/<policy-valid-file> \
KNOWN_DOCUMENT_URL=/documents/manual/<policy-valid-file>.pdf \
./deploy.sh
```

For an existing cutover, the candidate checks writable/searchable storage roots and fetches both
known URLs before recording success. On a first deployment, omit both known URLs: the candidate
creates, fetches, and removes non-user probes in both runtime roots. If it fails, keep traffic isolated. Rollback stops the
candidate, restores the previous image with the same named volumes at the old public paths,
checks health and both known URLs, and only then permits traffic to return. Never recreate, rename,
delete, or globally path-replace the named volumes.
