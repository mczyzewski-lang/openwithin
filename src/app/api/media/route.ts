import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { localStoragePath, verifyLocalSignature } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Local-storage file server for signed URLs (development / single node). Supports Range for seeking. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("k") ?? "";
  const exp = Number(req.nextUrl.searchParams.get("e"));
  const sig = req.nextUrl.searchParams.get("s") ?? "";
  if (!verifyLocalSignature(key, exp, sig)) return new NextResponse(null, { status: 403 });
  let file: string;
  let size: number;
  try {
    file = localStoragePath(key);
    size = (await stat(file)).size;
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=600",
  };
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new NextResponse(stream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}
