import { defineConfig } from "vitest/config";
import path from "node:path";

const testDb = process.env.TEST_DATABASE_URL ?? "postgres://openwithin:openwithin@localhost:5432/openwithin_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/empty-module.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    globalSetup: ["tests/setup-db.ts"],
    env: {
      DATABASE_URL: testDb,
      DEMO_MODE: "true",
      INLINE_WORKER: "false",
      LOCAL_STORAGE_DIR: "./storage-test",
      LLM_PROVIDER: "none",
      ELEVENLABS_API_KEY: "",
      STRIPE_SECRET_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
    },
  },
});
