### E2E Tests: Home Smoke

**Suite ID:** `HOME-E2E`
**Feature:** Foundation page availability

---

## Test Case: `HOME-E2E-001` - Loads the foundation page

**Priority:** `critical`

**Tags:**
- type → @e2e
- feature → @home

**Description/Objective:** Verify the initial App Router shell can boot through the Playwright harness.

**Preconditions:**
- The Next.js dev server can start.

### Flow Steps:
1. Navigate to `/`.
2. Wait for the page to finish loading.
3. Check the foundation heading and document title.

### Expected Result:
- The page displays `Ecommerce rebuild foundation`.
- The document title contains `SOPROTELCO`.
