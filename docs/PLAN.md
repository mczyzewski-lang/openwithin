# Implementation plan & status

Legend: ✅ built and tested · 🟡 built, needs live credentials to verify · ⏳ not yet built

## Phase 1 — Consumer MVP
- ✅ Brand identity (palette, typography, breathing-light motif, particles, Lucide icons), mobile-first
- ✅ Homepage (hero, animated story placeholder for the VSL, generator as primary action, "a voice that knows your story", pillars, popular experiences, Studio teaser)
- ✅ Technique registry (22 techniques, 5 system programmes) and 51 SEO landing pages (17 × en/pl/es) with native slugs, aliases, canonical, hreflang, JSON-LD, sitemap, robots
- ✅ Multilingual architecture (UI ≠ recording language; de/fr/it/pt prepared)
- ✅ Personalization form: 3 steps with progress, technique-specific questions, Polish vocative preview
- 🟡 Real ElevenLabs 15-second preview (pipeline verified end-to-end with the demo voice; ElevenLabs call written against the documented API but not reachable from the build sandbox)
- 🟡 Authentication after preview (Supabase Google / Apple / email magic link implemented; verified with demo sign-in)
- ✅ Free 5-minute experience generated in a background job from pre-login settings
- ✅ Audio player (position memory, Media Session, ±15 s), personal library, favourites, replays

## Phase 2 — Monetization
- 🟡 Stripe Checkout (one-off + subscription), signature-verified idempotent webhook (verified with demo checkout)
- ✅ Offers from DB per market (29 PLN / 79 PLN / 49 PLN per month, EUR & USD price lists), admin-editable
- ✅ Entitlements: atomic credits, free trial once, refunds on failed generation, product access
- ✅ Cost control: preview pipeline without LLM, segment cache, daily TTS character budget, rate limits, usage ledger

## Phase 3 — Professional Studio
- ✅ Professional onboarding & profile/branding, clinical mode for psychologists/psychotherapists
- ✅ Script composition (LLM or composer) with placeholders, line-by-line editor with pauses, live safety checks
- ✅ Studio samples (first ~45 s), plan quotas
- ✅ Products (single / multi-day programme), prices per currency, visibility, discount codes, share links
- ✅ Publication with responsibility acknowledgement + automated validation → moderation queue
- ✅ Storefront `openwithin.app/{creator}` and product pages `openwithin.app/{creator}/{product}`

## Phase 4 — Marketplace
- 🟡 Stripe Connect Express onboarding, `account.updated` sync
- ✅ Commission ledger (configurable 30/70 and Pro rate), payouts recorded as held while `MARKETPLACE_PAYOUTS_ENABLED=false`
- ✅ Aggregated professional analytics (visits, preview plays, checkout starts, purchases, conversion, revenue, repeat buyers)

## Phase 5 — Retention & scaling
- ✅ Programmes with progress (no streaks/guilt), "How would you like to feel today?" quick start from saved profile
- ✅ Retention metrics from real behaviour (D1/D7/D30, replays, completions, programme continuation, repeat purchases, regenerations, creator activity) in `/admin`
- 🟡 Reminders: preferences stored; ⏳ delivery (email/push sender + scheduler) not built
- ⏳ Professional voice cloning: consent + request flow built; ⏳ ElevenLabs voice-clone API call and identity verification provider not integrated
- ⏳ Experimentation framework (A/B prices), DB-driven `localization_content` overrides (table exists, not wired)
- ⏳ Translations for de/fr/it/pt
