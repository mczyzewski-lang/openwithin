import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __owSql?: postgres.Sql };

const client =
  globalForDb.__owSql ??
  postgres(env.DATABASE_URL, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    // Supabase transaction pooler (port 6543) does not support prepared statements.
    prepare: !env.DATABASE_URL.includes(":6543"),
    onnotice: () => {},
  });
if (env.NODE_ENV !== "production") globalForDb.__owSql = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
