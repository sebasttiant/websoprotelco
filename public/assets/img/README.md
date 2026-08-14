# SOPROTELCO Brand Assets

## `sp-logo.png` — primary mark

394 × 238 RGBA PNG. Black wordmark on transparency, for light backgrounds. This is the
authoritative artwork; the white variant is generated from it.

## `sp-logo-white.png` — reverse mark

500 × 302 RGBA PNG, generated from `sp-logo.png` rather than sourced separately. Every opaque
pixel becomes white, and its alpha is set from the source luminance, so the black ink resolves to
solid white while the light grey panel behind the check resolves to a faint tint that reads
correctly on `--color-brand-navy` (#0c1a2a).

Regenerating it from the primary mark is deliberate. The previous reverse mark was copied from a
legacy site as `soprotelco-logo-white.png` (2924 × 1878, SHA-256
`17a2ff85ed9c58ece86b4c0260ddb49c624413f59d1dabcaa7d0d47efdc30f26`) and carried two defects:

- the check glyph was mangled, spilling out of its panel toward the top-right corner instead of
  sitting inside it;
- its artwork proportions did not match the primary mark (content ratio 1.578 against 1.970), so
  the two marks could never be visually aligned with each other.

It was also 147 KB and duplicated byte-for-byte at `assets/brand/soprotelco-logo-white.png`, both
copies shipped to render at 36–56 px tall.

Deriving the reverse mark means the two can no longer drift apart. If the primary mark is ever
replaced, regenerate this one from it in the same pass.

Only verified static brand assets belong in this directory. Do not add Supabase URLs,
credentials, Base64 data URIs, generated build output, or runtime data exports.
