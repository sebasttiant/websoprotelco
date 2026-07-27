import { serveRuntimeAsset } from "@/server/storage/runtime-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext { params: Promise<{ path: string[] }>; }

export async function GET(_: Request, { params }: RouteContext): Promise<Response> {
  return serveRuntimeAsset("documents", (await params).path);
}
