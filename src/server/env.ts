import "server-only";
import { z } from "zod";
import { DEV_APP_SECRET } from "@/lib/constants";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "true");

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  APP_URL: z.string().default("http://localhost:3000"),
  APP_SECRET: z.string().min(16).default(DEV_APP_SECRET),
  DATABASE_URL: z.string().default("postgres://openwithin:openwithin@localhost:5432/openwithin"),
  DEMO_MODE: bool,

  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("audio"),
  AUTH_APPLE_ENABLED: bool,

  STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("./storage"),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_MODEL_FULL: z.string().default("eleven_multilingual_v2"),
  ELEVENLABS_MODEL_PREVIEW: z.string().default("eleven_flash_v2_5"),

  LLM_PROVIDER: z.enum(["anthropic", "none"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("claude-opus-5-5"),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  MARKETPLACE_PAYOUTS_ENABLED: bool,

  CRON_SECRET: z.string().optional(),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  FFPROBE_PATH: z.string().default("ffprobe"),

  PREVIEW_MAX_PER_ANON: z.coerce.number().default(3),
  PREVIEW_MAX_PER_IP_HOUR: z.coerce.number().default(6),
  PREVIEW_GLOBAL_DAILY: z.coerce.number().default(2000),
  TTS_DAILY_CHAR_BUDGET: z.coerce.number().default(2_000_000),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("OpenWithin <hello@openwithin.app>"),
});

export const env = schema.parse(process.env);

if (env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  if (env.APP_SECRET === DEV_APP_SECRET) throw new Error("APP_SECRET must be set in production");
  if (env.DEMO_MODE) console.warn("[openwithin] DEMO_MODE is enabled in production — demo auth/TTS/checkout must not be used with real users.");
}

export const features = {
  get supabaseAuth() {
    return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  /** Demo auth is only available when Supabase is not configured AND demo mode is explicitly on. */
  get demoAuth() {
    return !this.supabaseAuth && env.DEMO_MODE;
  },
  get elevenlabs() {
    return Boolean(env.ELEVENLABS_API_KEY);
  },
  /** Without an ElevenLabs key, demo mode renders a clearly-labelled offline voice (ffmpeg flite, English). */
  get demoTts() {
    return !this.elevenlabs && env.DEMO_MODE;
  },
  get llm() {
    return env.LLM_PROVIDER === "anthropic" && Boolean(env.ANTHROPIC_API_KEY);
  },
  get stripe() {
    return Boolean(env.STRIPE_SECRET_KEY);
  },
  get demoCheckout() {
    return !this.stripe && env.DEMO_MODE;
  },
};
