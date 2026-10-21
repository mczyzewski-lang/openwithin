import { NextResponse, type NextRequest } from "next/server";
import { getAnonId, getCurrentUser } from "@/server/auth/session";
import { getAudioForViewer } from "@/server/experiences";
import { storage } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Authorized access to private audio: ownership check, then a short-lived signed URL. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });
  const [user, anonId] = await Promise.all([getCurrentUser(), getAnonId()]);
  const audio = await getAudioForViewer(id, { userId: user?.id, anonId });
  if (!audio) return new NextResponse(null, { status: 404 });
  const url = await storage().signedUrl(audio.storageKey, 60 * 30);
  const target = url.startsWith("http") ? url : new URL(url, req.nextUrl.origin).toString();
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
