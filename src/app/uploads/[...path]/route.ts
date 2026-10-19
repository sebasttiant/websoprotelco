import { RUNTIME_ASSET_ROOTS, serveRuntimeAsset } from "@/server/storage/assets";

// Node runtime: the handler reads from the mounted uploads volume.
export const runtime = "nodejs";

// Never prerendered or cached by the framework — the whole point is to see the volume as it is
// right now, including a file written one millisecond ago.
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

/**
 * Serves product images and design (banner/hero) images uploaded after boot, which Next's
 * boot-time public-file index cannot see. Files that already existed at startup are still served
 * by the static handler; this route is the fallback that makes both cases behave identically.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;

  return serveRuntimeAsset(RUNTIME_ASSET_ROOTS.UPLOADS, path, request);
}

// Exported explicitly rather than left to the framework's implicit GET-without-body handling, so
// HEAD is a tested contract here and behaves the same for pre-boot and post-boot files.
export const HEAD = GET;
