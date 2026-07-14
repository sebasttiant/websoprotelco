import { NextResponse } from "next/server";

import { checkDatabaseConnection } from "@/server/db/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("check") !== "db") {
    return NextResponse.json({ status: "ok" });
  }

  const database = await checkDatabaseConnection();

  if (database.ok) {
    return NextResponse.json({ status: "ok", database });
  }

  return NextResponse.json({ status: "degraded", database }, { status: 503 });
}
