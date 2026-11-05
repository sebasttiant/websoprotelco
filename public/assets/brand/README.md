# Brand assets

Canonical SOPROTELCO mark (SP + fiber-yellow check + legal line), prepared for light and dark surfaces.

The check is a transparent SVG (`soprotelco-check.svg`): yellow tile `#F5C400`, navy stroke, white tick that breaks the top-right corner. Header and sidebar use the symbol lockup; footer and auth use the full lockup. Legacy PNGs stay byte-identical for the brand contract.

- `soprotelco-logo-source.png` — original upload (transparent background; mixed greys).
- `soprotelco-logo.png` — light-surface mark (navy SP/text, pale check square). Mirrored at `/assets/img/sp-logo.png`.
- `soprotelco-logo-white.png` — dark-surface mark (white SP/text). Mirrored at `/assets/img/sp-logo-white.png`.

Dimensions: **394 × 238** pixels, RGBA PNG.

UI must load logos through `BrandLogo` (`src/components/brand/brand-logo.tsx`) so header, footer, auth and admin stay aligned.
