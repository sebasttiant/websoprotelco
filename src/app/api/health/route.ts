import { NextResponse } from "next/server";

import { checkDatabaseConnection } from "@/server/db/pool";
import { checkStorageConfiguration } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const check = url.searchParams.get("check");

  if (check === "storage") {
    const storage = await checkStorageConfiguration();

    if (storage.ok) {
      return NextResponse.json({ status: "ok", storage });
    }

    return NextResponse.json({ status: "degraded", storage }, { status: 503 });
  }

  if (check !== "db") {
    return NextResponse.json({ status: "ok" });
  }

  const database = await checkDatabaseConnection();

  if (database.ok) {
    return NextResponse.json({ status: "ok", database });
  }

  return NextResponse.json({ status: "degraded", database }, { status: 503 });
}
