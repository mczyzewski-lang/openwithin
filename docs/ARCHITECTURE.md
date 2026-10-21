# OpenWithin — architecture

One Next.js 16 application (App Router, TypeScript, Tailwind v4, next-intl) serving three products
that share accounts, the personalization engine, the audio engine and payments:

| Product | Routes | Theme |
|---|---|---|
| **OpenWithin** (B2C) | `/{locale}`, `/{locale}/{landing-slug}`, `/create`, `/continue`, `/experience`, `/space`, `/profile`, `/programs`, `/plans` | dark |
| **OpenWithin Studio** (B2B) | `/{locale}/studio/**` | light |
| **OpenWithin Store** (B2B2C) | `/{creator}` and `/{creator}/{product}` (rewritten by `src/proxy.ts` to `/{locale}/store/...`), `/{locale}/share/{token}` | dark |

```
Browser ──► proxy.ts (locale, anon cookie, Supabase session refresh, clean store URLs)
   │
   ├─ Server Components / Server Actions ─┐
   └─ /api/* route handlers ──────────────┤
                                          ▼
                              src/server/* (domain services)
   ┌──────────────┬──────────────┬───────────────┬──────────────┬─────────────┐
   scenario/      audio/         jobs/worker     billing/       studio/
   (personaliz.   (TTS, cache,   (Postgres queue (entitlements, (templates,
   composer, LLM, FFmpeg mix,    SKIP LOCKED,    Stripe,         products,
   validator)     storage)       retries)        fulfilment)     payouts)
                                          ▼
                       Postgres (Supabase) · private object storage · ElevenLabs · Anthropic · Stripe
```

## Personalization engine (`src/server/scenario`)
* **Technique registry** (`src/content/techniques/registry.ts`) — 22 techniques, each with its own
  ordered phases (time weight + speech ratio), question set, durations, ambient, safety rules and the
  kinds of personal context it may ever use. Landing pages, forms, composer, LLM prompt and validator
  are all driven from it.
* **Context builder** (`context.ts`) — turns form settings + stored profile into a
  `PersonalizationContext`: form of address (Polish vocative, user-correctable), curated grammatical
  forms for places (e.g. *na spokojnej plaży*), and *filtered* personal context items:
  only kinds the technique permits, only categories the user ticked, never "mixed" memories,
  max 1 (balanced) / 2 (deep) per session, nothing at "light" level.
* **Composer** (`composer.ts`) — deterministic, technique-aware script builder with native phrase
  banks for en/pl/es (gender-neutral phrasing in pl/es). Each phase gets a time and word budget;
  silence is distributed as `pause_after_ms`. Breath counts and muscle-tension holds get *fixed*
  pauses. The name is used in the opening and at most once per ~10 minutes.
* **LLM writer** (`llm.ts`) — Claude (`claude-opus-5-5`, structured JSON output, refusal fallback
  enabled) writes natively in the target language from the same phase plan; personal details are
  passed as data, never instructions. Timing stays engine-owned.
* **Validator** (`validate.ts`) — required phases & order, language detection, medical claims,
  trauma/EMDR/hypnosis, breath holds, wake-ups in sleep sessions, name overuse, length/cost caps.
  LLM output that fails validation falls back to the composer. Studio scripts go through the same
  checks before publication (flagged → moderation queue).

## Audio engine (`src/server/audio`)
* `tts.ts` — provider interface; **ElevenLabs** (`eleven_flash_v2_5` for previews,
  `eleven_multilingual_v2` for sessions, speed via voice settings, retries with backoff on 429/5xx,
  timeouts). A clearly-labelled **demo provider** (FFmpeg flite) exists only for local development.
* `engine.ts` — segment cache keyed by a hash of (provider, model, voice, language, speed, text):
  identical sentences are synthesized once (huge savings for Studio products shared by many buyers);
  daily character budget guard; `fitPauses()` rescales flexible pauses to hit the exact target length
  from *measured* speech durations; `assemble()` builds one FFmpeg filter graph: `adelay`/`apad`
  silences, concat, procedurally generated ambient bed (rain/ocean/wind/night/soft tones — synthesized,
  so no licensing questions) ducked under the voice with `sidechaincompress`, fades, `loudnorm`
  to −19 LUFS, MP3.
* **Preview pipeline**: composer opening → one TTS call → one FFmpeg pass, hard-capped at 15 s
  (`atrim` + fade). Synchronous (~1–3 s), cheap, no LLM.
* **Full sessions** never run in the browser request: a `generation_jobs` row is queued and a worker
  claims it with `FOR UPDATE SKIP LOCKED` (`npm run worker`, `/api/cron/jobs`, or inline via
  `after()` in dev). Status: queued → scripting → synthesizing → assembling → completed/failed.
  Retries with exponential backoff; stale locks are recovered; a permanently failed job refunds its
  credit exactly once.

## Data model (`src/server/db/schema.ts`, migration in `drizzle/`)
Separations required by the brief:
* **scenario vs audio** — `audio_scenarios` + `audio_segments` (text, voice, pauses, ambient,
  segment_type) vs `generated_audio` (file).
* **template vs instance** — `experience_templates.base_segments` (Studio script with `{{name}}`,
  `{{place}}`…) vs each buyer's `audio_scenarios` row.
* **purchase vs access** — `purchases` (one per checkout, unique) vs `entitlements`
  (credits, product access, plan access; atomically consumed).
* **consumer vs professional** — `users` vs `professional_profiles` (a person can be both).

Funnel state lives in `experience_drafts` (anonymous cookie id → claimed on login), so signing in
never loses the form or the preview.

## Payments
Stripe Checkout with `price_data` (prices come from `offer_prices` / `product_variants`, editable in
`/admin`). Webhook (`/api/stripe/webhook`) is signature-verified and idempotent. Marketplace: charges on
the platform, `platform_commissions` ledger (30/70 starter, 15/85 Pro by default, configurable),
Stripe Connect Express onboarding, payouts recorded as **held** unless `MARKETPLACE_PAYOUTS_ENABLED=true`
and the connected account can receive payouts.

## i18n
UI locales en/pl/es are live; de/fr/it/pt are prepared in `src/i18n/locales.ts`. UI language and
recording language are independent. Landing slugs are native per language (`/pl/trening-jacobsona`,
`/es/relajacion-muscular-progresiva`), aliases 308-redirect to the canonical page, every page has
canonical + hreflang + x-default, FAQPage/Breadcrumb JSON-LD, and appears in `sitemap.xml`.

## Security & privacy
Private audio behind `/api/audio/[id]` (ownership check → 30-minute signed URL); RLS enabled on all
tables in Supabase (`supabase/setup.sql`) so the anon key exposes nothing; rate limits in Postgres
(per IP, per visitor, global); free-text screening (links, contact data, prompt injection, crisis
language → supportive message); data export, profile deletion and account deletion; marketing consent
separate from registration; digital-content withdrawal consent before payment; anonymous previews
expire after 30 days; working files deleted after each job.
