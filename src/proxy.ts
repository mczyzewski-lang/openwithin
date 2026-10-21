import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { landingEntries } from "@/content/techniques";
import { DEV_APP_SECRET, RESERVED_SEGMENTS } from "@/lib/constants";
import { routing } from "@/i18n/routing";

const intl = createIntlMiddleware(routing);
const ANON_COOKIE = "ow_anon";
const LOCALES = routing.locales as readonly string[];
const LANDING_SLUGS = new Set(landingEntries().flatMap((e) => [e.slug, ...(e.copy.aliases ?? [])]));

function b64url(buf: ArrayBuffer) {
  return Buffer.from(new Uint8Array(buf)).toString("base64url");
}

async function signedAnonValue(): Promise<string> {
  const value = crypto.randomUUID();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(process.env.APP_SECRET || DEV_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`anon:${value}`));
  return `${value}.${b64url(sig)}`;
}

function preferredLocale(req: NextRequest): string {
  const cookie = req.cookies.get("ow_locale")?.value;
  if (cookie && LOCALES.includes(cookie)) return cookie;
  const accept = req.headers.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (LOCALES.includes(code)) return code;
  }
  return routing.defaultLocale;
}

/** Clean creator URLs: openwithin.app/anna-kowalska/7-days-relaxation → /{locale}/store/anna-kowalska/7-days-relaxation */
function storeRewrite(req: NextRequest): URL | null {
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length < 1 || segments.length > 2) return null;
  const [first] = segments;
  if (LOCALES.includes(first) || (RESERVED_SEGMENTS as readonly string[]).includes(first) || LANDING_SLUGS.has(first) || first.includes(".")) return null;
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(first)) return null;
  const url = req.nextUrl.clone();
  url.pathname = `/${preferredLocale(req)}/store/${segments.join("/")}`;
  return url;
}

export default async function proxy(req: NextRequest) {
  const rewrite = storeRewrite(req);
  const res = rewrite ? NextResponse.rewrite(rewrite) : intl(req);

  if (!req.cookies.get(ANON_COOKIE)) {
    res.cookies.set(ANON_COOKIE, await signedAnonValue(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  }

  // Keep the Supabase session fresh (no-op when Supabase is not configured).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    });
    await supabase.auth.getUser();
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
