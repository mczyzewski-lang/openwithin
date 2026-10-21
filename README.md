# OpenWithin

**Close your eyes. Open your world.** — personalized guided audio experiences (meditation, relaxation,
Yoga Nidra, Jacobson, breathing, visualization, sleep), with **OpenWithin Studio** for professionals and
**OpenWithin Store** for selling personalized programmes.

* Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
* Plan & status per phase: [`docs/PLAN.md`](docs/PLAN.md)

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · next-intl · Drizzle ORM + PostgreSQL (Supabase) ·
Supabase Auth & Storage · ElevenLabs TTS · Anthropic Claude (scripts) · FFmpeg · Stripe Checkout / Billing / Connect ·
Vitest · Playwright.

## Run locally (demo mode, no API keys)
Requirements: Node ≥ 20.9, PostgreSQL 14+, FFmpeg (with `flite` for the demo voice).

```bash
npm install
cp .env.example .env            # keep DEMO_MODE=true for keyless local runs
createdb openwithin              # or point DATABASE_URL at any Postgres
npm run db:migrate
npm run db:seed                  # voices, techniques, offers & prices, commission, programmes
npm run dev                      # http://localhost:3000
```

Demo mode is explicit and labelled in the UI: passwordless demo sign-in, an offline robotic placeholder
voice (FFmpeg flite, English phonetics) and a simulated checkout. Each switches off automatically once the
real provider is configured. Make yourself admin with
`update users set is_admin = true where email = 'you@example.com';` and open `/en/admin`.

## Production setup
1. **Supabase** — create a project; `DATABASE_URL` = the Postgres connection string; run
   `npm run db:migrate && npm run db:seed`, then `supabase/setup.sql` in the SQL editor (enables RLS,
   creates the private `audio` bucket). Auth → enable Email (magic link), Google and optionally Apple
   (`AUTH_APPLE_ENABLED=true`); add `{APP_URL}/auth/callback` to redirect URLs. Set
   `STORAGE_DRIVER=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`.
2. **ElevenLabs** — `ELEVENLABS_API_KEY`. Check that the seeded premade voice ids (`voice_presets`
   table, see `src/server/voices.ts`) exist in your account; edit them in the table if needed.
3. **Anthropic** — `ANTHROPIC_API_KEY` (model `LLM_MODEL`, default `claude-opus-5-5`). Without it,
   the built-in technique composer writes all scripts.
4. **Stripe (test mode first)** — `STRIPE_SECRET_KEY=sk_test_…`; webhook endpoint
   `{APP_URL}/api/stripe/webhook` with events `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `invoice.paid`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `charge.refunded`, `account.updated` → `STRIPE_WEBHOOK_SECRET`.
   Enable Connect (Express) for the marketplace. Leave `MARKETPLACE_PAYOUTS_ENABLED=false` until the
   seller-of-record, tax and refund model is settled.
5. **Worker** — run `npm run worker` next to the web app (`INLINE_WORKER=false`), or on serverless
   schedule `GET /api/cron/jobs` with `Authorization: Bearer $CRON_SECRET` every minute. The worker host
   needs FFmpeg.
6. Set `APP_URL`, a strong `APP_SECRET`, and `DEMO_MODE=false`.

## Tests
```bash
createdb openwithin_test
npm test            # 248 unit + integration tests (real Postgres + FFmpeg): composer for every technique
                    # × language, validator, privacy rules, i18n completeness, SEO, funnel, checkout
                    # idempotency, credit refunds, Studio → Store → personalized delivery, commissions
npm run build && npm start
npm run test:e2e    # Playwright, iPhone viewport: landing → preview → sign-in → 5-min session → upsell
```

## Honest status
* The whole pipeline (preview, background generation, assembly, library, checkout, Studio, Store) runs and
  is tested end to end **with the demo voice and demo checkout**. ElevenLabs, Anthropic, Stripe and Supabase
  integrations are complete code paths written against their documented APIs, but could not be exercised
  against the live services from the build environment (no network access / keys). Verify them in a staging
  environment with test keys before launch.
* Legal texts in `src/content/legal.ts` are drafts for counsel review.
* Not built yet: reminder delivery, ElevenLabs voice-clone call + identity verification, A/B testing,
  de/fr/it/pt translations — see `docs/PLAN.md`.
