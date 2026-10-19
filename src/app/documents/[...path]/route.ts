import { RUNTIME_ASSET_ROOTS, serveRuntimeAsset } from "@/server/storage/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

/**
 * Serves PDF documents uploaded after boot. `X-Content-Type-Options: nosniff` and
 * `Content-Disposition: attachment` are applied to every `/documents/:path*` response by the
 * `headers()` rule in next.config.ts, so a maliciously crafted PDF is never rendered inline —
 * the same contract the static handler had, now honoured for runtime-created files too.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;

  return serveRuntimeAsset(RUNTIME_ASSET_ROOTS.DOCUMENTS, path, request);
}

export const HEAD = GET;
