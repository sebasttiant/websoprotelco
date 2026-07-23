### E2E Tests: Home Smoke

**Suite ID:** `HOME-E2E`
**Feature:** Public SOPROTELCO shell availability

---

## Test Case: `HOME-E2E-001` - Loads the public SOPROTELCO shell

**Priority:** `critical`

**Tags:**
- type → @e2e
- feature → @home

**Description/Objective:** Verify the public SOPROTELCO shell can boot through the Playwright harness.

**Preconditions:**
- The Next.js dev server can start.

### Flow Steps:
1. Navigate to `/`.
2. Wait for the page to finish loading.
3. Check the visible, accessible primary navigation and document title.

### Expected Result:
- The page displays the accessible `Navegación principal` landmark and its visible `Productos` link.
- The document title contains `SOPROTELCO`.

## Test Case: `HOME-E2E-002` - Operates compact primary navigation

**Priority:** `high`

**Tags:**
- type → @e2e
- feature → @home

**Description/Objective:** Verify the small-screen navigation keeps its accessible toggle and product route available.

### Flow Steps:
1. Set a 375px-wide viewport.
2. Navigate to `/`.
3. Open `Abrir menú` and inspect `Navegación móvil`.

### Expected Result:
- The toggle exposes `aria-expanded="true"` after interaction.
- The mobile landmark exposes the `Productos` link.
