import { existsSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { diskPathForPublicUrl, recordCreatedFile, removeCreatedFile, removeRecordedFiles, runtimeRoot } from "../created-files";
import {
  capturePersistedState,
  environment,
  expectJsonError,
  PDF_BYTES,
  PNG_BYTES,
  repositoryDataRoot,
  signIn,
  snapshotTree,
  type SignedInSession,
} from "./support";

const NOT_FOUND_HEADING = "No encontramos lo que buscás";
const SEEDED_PRODUCT_NAME = "Fusionadora E2E";
const SEEDED_PRODUCT_SKU = "E2E-001";

const ADMIN_ONLY_PAGES = [
  { path: "/admin", privilegedHeading: "Panel de control" },
  { path: "/admin/reports", privilegedHeading: "Reportes" },
  { path: "/admin/design", privilegedHeading: "Diseño del sitio" },
  { path: "/admin/documents", privilegedHeading: "Documentación" },
  { path: "/admin/categories/new", privilegedHeading: "Nueva categoría" },
] as const;

const EXPORT_URLS = [
  "/admin/reports/export?range=all&section=all&format=csv",
  "/admin/reports/export?range=all&section=summary&format=csv",
  "/admin/reports/export?range=all&section=all&format=xlsx",
] as const;

interface UploadSurface {
  name: string;
  endpoint: string;
  rejection: string;
  buildMultipart(): Record<string, string | { name: string; mimeType: string; buffer: Buffer }>;
}

const UPLOAD_SURFACES: readonly UploadSurface[] = [
  {
    name: "catalog image",
    endpoint: "/api/upload",
    rejection: "Necesitás permiso para editar el catálogo.",
    buildMultipart: () => ({ file: { name: "e2e.png", mimeType: "image/png", buffer: PNG_BYTES } }),
  },
  {
    name: "design image",
    endpoint: "/api/design/upload",
    rejection: "Necesitás permiso para editar el diseño.",
    buildMultipart: () => ({
      file: { name: "e2e.png", mimeType: "image/png", buffer: PNG_BYTES },
      target: "hero",
    }),
  },
  {
    name: "document",
    endpoint: "/api/documents/upload",
    rejection: "Necesitás permiso para editar documentos.",
    buildMultipart: () => ({
      file: { name: "e2e.pdf", mimeType: "application/pdf", buffer: PDF_BYTES },
      category: "manual",
    }),
  },
];

// Serial on purpose: the "nothing changed" assertions compare whole-database digests and the
// runtime asset directories, so two tests mutating them at once would corrupt each other.
test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  removeRecordedFiles(environment.runId);
});

// The HTTP status is deliberately not asserted for admin PAGES: src/app/admin/loading.tsx makes
// them stream behind a Suspense boundary, so the 200 is committed before the page guard calls
// notFound() and the not-found UI arrives later in the same stream. What matters is content:
// the privileged UI is absent and no privileged data appears anywhere in the bytes delivered,
// including the serialized server-component payload that the DOM would not show.
async function expectAdminAreaHidden(page: Page, path: string, privilegedHeading: string): Promise<void> {
  const response = await page.goto(path);
  const rawBody = (await response?.text()) ?? "";

  await expect(page.getByRole("heading", { name: NOT_FOUND_HEADING })).toBeVisible();
  await expect(page.getByRole("heading", { name: privilegedHeading, exact: true })).toHaveCount(0);

  for (const body of [rawBody, await page.content()]) {
    expect(body).not.toContain(SEEDED_PRODUCT_NAME);
    expect(body).not.toContain(SEEDED_PRODUCT_SKU);
    expect(body).not.toContain(environment.admin.email);
  }
}

async function expectUploadsRejected(request: APIRequestContext, status: number, expectedMessage: (surface: UploadSurface) => string) {
  for (const surface of UPLOAD_SURFACES) {
    const response = await request.post(surface.endpoint, { multipart: surface.buildMultipart() });

    // If an upload is wrongly accepted, register what it wrote before failing so cleanup still
    // removes it; a broken guard must not also leave files behind on the developer's disk.
    if (response.status() === 201) {
      const stored = (await response.json()) as { url?: string; filePath?: string };
      const publicUrl = stored.url ?? stored.filePath;

      if (publicUrl) recordCreatedFile(environment.runId, diskPathForPublicUrl(publicUrl));
    }

    await expectJsonError(response, status, expectedMessage(surface));
  }
}

test.describe("isolated runtime storage", () => {
  test(
    "the app server writes to a throwaway workspace, never to the repository data directory",
    { tag: ["@critical", "@e2e", "@authenticated", "@AUTH-E2E-008"] },
    () => {
      // A fresh checkout has no repository `data/` at all; that absence is itself
      // proof nothing can leak into it, so the comparison is skipped, not failed.
      const repositoryData = existsSync(repositoryDataRoot()) ? realpathSync(repositoryDataRoot()) : null;

      expect(realpathSync(environment.appDirectory)).not.toBe(realpathSync(process.cwd()));
      expect(readdirSync(environment.appDirectory).filter((name) => name.startsWith(".env"))).toEqual([]);

      for (const kind of ["uploads", "documents"] as const) {
        const root = realpathSync(runtimeRoot(kind));

        expect(root.startsWith(path.join(realpathSync(environment.appDirectory), "data") + path.sep)).toBe(true);
        expect(repositoryData === null || (root !== repositoryData && !root.startsWith(repositoryData + path.sep))).toBe(true);
        // A fresh workspace starts empty: nothing from the developer's disk was carried over.
        expect(readdirSync(root)).toEqual([]);
      }
    },
  );
});

test.describe("anonymous visitors", () => {
  test(
    "are sent to sign in and cannot export or upload",
    { tag: ["@critical", "@e2e", "@authenticated", "@AUTH-E2E-001"] },
    async ({ page, request }) => {
      const before = await capturePersistedState();

      await page.goto("/admin");
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();

      for (const url of EXPORT_URLS) {
        await expectJsonError(await request.get(url), 401, "Se requiere iniciar sesión.");
      }

      await expectUploadsRejected(request, 401, () => "Se requiere iniciar sesión.");

      expect(await capturePersistedState()).toEqual(before);
    },
  );
});

test.describe("customer", () => {
  let session: SignedInSession;

  test.beforeAll(async ({ browser }) => {
    session = await signIn(browser, environment.customer, /\/cuenta$/);
  });

  test.afterAll(async () => {
    await session.context.close();
  });

  test(
    "lands on the account page and is refused every admin surface",
    { tag: ["@critical", "@e2e", "@authenticated", "@AUTH-E2E-002"] },
    async () => {
      const { page } = session;

      await expect(page.getByRole("heading", { name: "Mi cuenta" })).toBeVisible();
      const before = await capturePersistedState();

      for (const { path, privilegedHeading } of ADMIN_ONLY_PAGES) {
        await expectAdminAreaHidden(page, path, privilegedHeading);
        // The admin chrome must not advertise sections the role cannot open.
        await expect(page.getByRole("link", { name: "Reportes" })).toHaveCount(0);
      }

      expect(await capturePersistedState()).toEqual(before);
    },
  );

  test(
    "cannot download report exports in any format",
    { tag: ["@critical", "@e2e", "@authenticated", "@AUTH-E2E-003"] },
    async () => {
      const before = await capturePersistedState();

      for (const url of EXPORT_URLS) {
        const response = await session.context.request.get(url);

        await expectJsonError(response, 403, "Necesitás permiso para ver reportes.");
        expect(await response.text()).not.toContain("metric,value");
      }

      expect(await capturePersistedState()).toEqual(before);
    },
  );

  test(
    "cannot upload images or documents and leaves rows, counters and files untouched",
    { tag: ["@critical", "@e2e", "@authenticated", "@AUTH-E2E-004"] },
    async () => {
      const before = await capturePersistedState();

      await expectUploadsRejected(session.context.request, 403, (surface) => surface.rejection);

      expect(await capturePersistedState()).toEqual(before);
    },
  );
});

test.describe("admin", () => {
  let session: SignedInSession;

  test.beforeAll(async ({ browser }) => {
    session = await signIn(browser, environment.admin, /\/admin$/);
  });

  test.afterAll(async () => {
    await session.context.close();
  });

  test(
    "reaches the dashboard and its data sections",
    { tag: ["@critical", "@e2e", "@authenticated", "@AUTH-E2E-005"] },
    async () => {
      const { page } = session;

      await page.goto("/admin");

      await expect(page.getByRole("heading", { name: "Panel de control" })).toBeVisible();
      await expect(page.getByText(environment.admin.email).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Pedidos recientes" })).toBeVisible();
      await expect(page.getByText("Stock bajo")).toBeVisible();
      await expect(page.getByRole("heading", { name: NOT_FOUND_HEADING })).toHaveCount(0);
    },
  );

  test(
    "reaches reports and downloads CSV and Excel exports",
    { tag: ["@critical", "@e2e", "@authenticated", "@AUTH-E2E-006"] },
    async () => {
      const { page, context } = session;
      const before = await capturePersistedState();

      const response = await page.goto("/admin/reports");
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Reportes", exact: true })).toBeVisible();

      const csvDownload = page.waitForEvent("download");
      await page.getByRole("link", { name: "CSV completo" }).click();
      const download = await csvDownload;
      expect(download.suggestedFilename()).toMatch(/^soprotelco-reporte-.*\.csv$|\.csv$/);

      const csv = await context.request.get("/admin/reports/export?range=all&section=summary&format=csv");
      expect(csv.status()).toBe(200);
      expect(csv.headers()["content-type"]).toContain("text/csv");
      expect(csv.headers()["content-disposition"]).toMatch(/^attachment; filename=".+\.csv"$/);
      expect(csv.headers()["cache-control"]).toBe("no-store");
      const csvBody = await csv.text();
      expect(csvBody).toContain("metric,value");
      expect(csvBody).toContain("catalog_total,1");

      const workbook = await context.request.get("/admin/reports/export?range=all&section=all&format=xlsx");
      expect(workbook.status()).toBe(200);
      expect(workbook.headers()["content-type"]).toContain("spreadsheetml");
      expect((await workbook.body()).subarray(0, 2).toString("latin1")).toBe("PK");

      expect(await capturePersistedState()).toEqual(before);
    },
  );

  test(
    "reaches the upload surfaces and each upload endpoint accepts a valid file",
    { tag: ["@critical", "@e2e", "@authenticated", "@AUTH-E2E-007"] },
    async () => {
      const { page, context } = session;
      const baseline = await capturePersistedState();
      const created: string[] = [];

      const trackUpload = (url: string): void => {
        const absolutePath = diskPathForPublicUrl(url);
        recordCreatedFile(environment.runId, absolutePath);
        created.push(absolutePath);
      };

      try {
        // Catalog image: product form embeds the upload field (category images were removed).
        await page.goto("/admin/products/new");
        await expect(page.getByRole("heading", { name: "Nuevo producto" })).toBeVisible();
        const catalogUpload = page.waitForResponse((r) => r.url().endsWith("/api/upload") && r.request().method() === "POST");
        await page.getByLabel("Subir imagen").setInputFiles({ name: "e2e.png", mimeType: "image/png", buffer: PNG_BYTES });
        const catalogResponse = await catalogUpload;
        expect(catalogResponse.status()).toBe(201);
        trackUpload(((await catalogResponse.json()) as { url: string }).url);
        await expect(page.getByText("Imagen lista")).toBeVisible();

        // Design image: the hero background field on the appearance page.
        await page.goto("/admin/design");
        await expect(page.getByRole("heading", { name: "Diseño del sitio" })).toBeVisible();
        const designUpload = page.waitForResponse((r) => r.url().endsWith("/api/design/upload") && r.request().method() === "POST");
        await page.getByLabel("Subir imagen").first().setInputFiles({ name: "e2e.png", mimeType: "image/png", buffer: PNG_BYTES });
        const designResponse = await designUpload;
        expect(designResponse.status()).toBe(201);
        trackUpload(((await designResponse.json()) as { url: string }).url);

        // Document: the PDF field on the documentation page.
        await page.goto("/admin/documents");
        await expect(page.getByRole("heading", { name: "Documentación", exact: true })).toBeVisible();
        const documentUpload = page.waitForResponse((r) => r.url().endsWith("/api/documents/upload") && r.request().method() === "POST");
        await page.getByLabel("Subir PDF").setInputFiles({ name: "e2e.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
        const documentResponse = await documentUpload;
        expect(documentResponse.status()).toBe(201);
        const documentPayload = (await documentResponse.json()) as { filePath: string };
        trackUpload(documentPayload.filePath);
        await expect(page.getByText("El documento se subió correctamente.")).toBeVisible();

        // The files really exist, in the workspace the server runs from...
        for (const absolutePath of created) {
          expect(existsSync(absolutePath)).toBe(true);
          expect(absolutePath.startsWith(path.join(environment.appDirectory, "data") + path.sep)).toBe(true);
          expect(absolutePath.startsWith(repositoryDataRoot() + path.sep)).toBe(false);
        }

        // ...and while they exist, the developer's own data/ is still identical, byte for byte.
        expect(snapshotTree(repositoryDataRoot())).toEqual(baseline.repositoryData);

        // Authorization passed on every endpoint, so an empty body now reaches validation (400)
        // instead of being stopped at the 401/403 gate.
        for (const surface of UPLOAD_SURFACES) {
          const empty = await context.request.post(surface.endpoint, { multipart: { target: "hero" } });

          expect(empty.status()).toBe(400);
        }
      } finally {
        for (const absolutePath of created) {
          removeCreatedFile(absolutePath);
        }
      }

      // Only files can have changed: with the three created files removed, the persisted state
      // (rows, counters and runtime assets) must equal the pre-upload baseline.
      expect(await capturePersistedState()).toEqual(baseline);
    },
  );
});
