import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { exportAccount } from "@/server/account";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return new NextResponse(JSON.stringify(await exportAccount(user.id), null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="openwithin-export.json"' },
  });
}
