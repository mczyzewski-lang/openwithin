import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

/**
 * Private object storage for audio. Files are never public: access goes through
 * /api/audio/[id] (ownership check) which hands out short-lived signed URLs.
 */
export interface ObjectStorage {
  driver: "local" | "supabase";
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  remove(keys: string[]): Promise<void>;
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
}

/* ───────────── local filesystem (development / single-node) ───────────── */

export function signLocal(key: string, exp: number): string {
  return createHmac("sha256", env.APP_SECRET).update(`media:${key}:${exp}`).digest("base64url");
}

export function verifyLocalSignature(key: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signLocal(key, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function safeKey(key: string) {
  if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes("..")) throw new Error("invalid storage key");
  return key;
}

class LocalStorage implements ObjectStorage {
  driver = "local" as const;
  private root = path.resolve(env.LOCAL_STORAGE_DIR);

  pathFor(key: string) {
    return path.join(this.root, safeKey(key));
  }

  async put(key: string, data: Buffer) {
    const p = this.pathFor(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  get(key: string) {
    return readFile(this.pathFor(key));
  }

  async exists(key: string) {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(keys: string[]) {
    await Promise.all(keys.map((k) => rm(this.pathFor(k), { force: true })));
  }

  async signedUrl(key: string, ttlSeconds: number) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const q = new URLSearchParams({ k: safeKey(key), e: String(exp), s: signLocal(key, exp) });
    return `/api/media?${q.toString()}`;
  }
}

/* ───────────── Supabase Storage (production) ───────────── */

class SupabaseStorage implements ObjectStorage {
  driver = "supabase" as const;
  private client: SupabaseClient;
  private bucket = env.SUPABASE_STORAGE_BUCKET;

  constructor() {
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase storage not configured");
    this.client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }

  async put(key: string, data: Buffer, contentType: string) {
    const { error } = await this.client.storage.from(this.bucket).upload(safeKey(key), data, { contentType, upsert: true });
    if (error) throw error;
  }

  async get(key: string) {
    const { data, error } = await this.client.storage.from(this.bucket).download(safeKey(key));
    if (error || !data) throw error ?? new Error("not found");
    return Buffer.from(await data.arrayBuffer());
  }

  async exists(key: string) {
    const dir = path.posix.dirname(key);
    const name = path.posix.basename(key);
    const { data } = await this.client.storage.from(this.bucket).list(dir === "." ? "" : dir, { search: name, limit: 1 });
    return !!data?.some((f) => f.name === name);
  }

  async remove(keys: string[]) {
    if (!keys.length) return;
    await this.client.storage.from(this.bucket).remove(keys.map(safeKey));
  }

  async signedUrl(key: string, ttlSeconds: number) {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(safeKey(key), ttlSeconds);
    if (error || !data) throw error ?? new Error("could not sign");
    return data.signedUrl;
  }
}

let instance: ObjectStorage | null = null;
export function storage(): ObjectStorage {
  if (!instance) instance = env.STORAGE_DRIVER === "supabase" ? new SupabaseStorage() : new LocalStorage();
  return instance;
}

export function localStoragePath(key: string): string {
  return new LocalStorage().pathFor(key);
}
