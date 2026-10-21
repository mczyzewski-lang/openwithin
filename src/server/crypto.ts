import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export function sign(value: string, purpose: string): string {
  const mac = createHmac("sha256", env.APP_SECRET).update(`${purpose}:${value}`).digest("base64url");
  return `${value}.${mac}`;
}

export function unsign(signed: string | undefined | null, purpose: string): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from(sign(value, purpose));
  const given = Buffer.from(signed);
  return expected.length === given.length && timingSafeEqual(expected, given) ? value : null;
}

export function randomToken(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}
