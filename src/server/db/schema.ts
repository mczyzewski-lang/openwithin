/**
 * OpenWithin data model.
 *
 * Key separations (see docs/ARCHITECTURE.md):
 * - scenario (audio_scenarios + audio_segments) vs. rendered file (generated_audio)
 * - product template (products/experience_templates) vs. personalised instance (audio_scenarios owned by a buyer)
 * - purchase (purchases) vs. right of access (entitlements)
 * - consumer account (users) vs. professional account (professional_profiles) — one person can be both.
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

/* ───────────────────────── Accounts ───────────────────────── */

export const users = pgTable(
  "users",
  {
    id: id(),
    authProvider: text("auth_provider").notNull(), // 'supabase' | 'demo'
    authSubject: text("auth_subject").notNull(),
    email: text("email"),
    uiLocale: text("ui_locale").notNull().default("en"),
    market: text("market").notNull().default("intl"),
    isAdmin: boolean("is_admin").notNull().default(false),
    freeSessionGrantedAt: ts("free_session_granted_at"),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at"),
  },
  (t) => [uniqueIndex("users_auth_uq").on(t.authProvider, t.authSubject)],
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  timezone: text("timezone"),
  remindersEnabled: boolean("reminders_enabled").notNull().default(false),
  reminderTime: text("reminder_time"), // "21:30" local time
  reminderDays: text("reminder_days").array(), // ['mon','wed']
  updatedAt: updatedAt(),
});

export const consents = pgTable(
  "consents",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // terms | privacy | marketing | digital_content | voice_clone | professional_terms
    version: text("version").notNull(),
    granted: boolean("granted").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("consents_user_idx").on(t.userId, t.kind)],
);

/* ───────────────────────── Personalisation ───────────────────────── */

export const personalizationProfiles = pgTable("personalization_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // Identity
  firstName: text("first_name"),
  nameVocative: text("name_vocative"), // user-confirmed form of address (e.g. Polish vocative)
  recordingLanguage: text("recording_language"),
  voicePresetId: text("voice_preset_id"),
  // Environment
  favoritePlace: text("favorite_place"),
  imaginedSetting: text("imagined_setting"),
  listeningEnvironment: text("listening_environment"), // bed | sofa | commute | outdoors | desk
  ambientSounds: text("ambient_sounds").array(),
  // Experience preferences
  narrationSpeed: text("narration_speed").notNull().default("calm"), // slow | calm | natural
  pauseLevel: text("pause_level").notNull().default("balanced"), // short | balanced | spacious
  defaultDurationMin: integer("default_duration_min").notNull().default(10),
  ambientTrackId: text("ambient_track_id"),
  personalizationLevel: text("personalization_level").notNull().default("balanced"), // light | balanced | deep
  style: text("style"),
  updatedAt: updatedAt(),
});

/**
 * Optional personal context (people, memories, motivations…). Each item carries the
 * categories in which the user allowed it to be used. Nothing here is required.
 */
export const personalContextItems = pgTable(
  "personal_context_items",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // person | memory | motivation | aspiration | goal
    label: text("label").notNull(),
    detail: text("detail"),
    tone: text("tone").notNull().default("neutral"), // positive | neutral | mixed — never assume positive
    allowedCategories: text("allowed_categories").array().notNull().default(sql`'{}'::text[]`),
    involvesThirdParty: boolean("involves_third_party").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("pci_user_idx").on(t.userId)],
);

/**
 * Pre-login funnel state. Holds the settings of an anonymous visitor so that signing in
 * never loses the form or the generated preview.
 */
export const experienceDrafts = pgTable(
  "experience_drafts",
  {
    id: id(),
    anonId: text("anon_id"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    techniqueId: text("technique_id").notNull(),
    productId: uuid("product_id"),
    uiLocale: text("ui_locale").notNull(),
    settings: jsonb("settings").notNull(),
    previewAudioId: uuid("preview_audio_id"),
    previewCount: integer("preview_count").notNull().default(0),
    programId: uuid("program_id"),
    programDay: integer("program_day"),
    fullScenarioId: uuid("full_scenario_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("drafts_anon_idx").on(t.anonId), index("drafts_user_idx").on(t.userId)],
);

/* ───────────────────────── Catalogue ───────────────────────── */

export const voicePresets = pgTable("voice_presets", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().default("elevenlabs"),
  providerVoiceId: text("provider_voice_id").notNull(),
  label: text("label").notNull(),
  character: text("character").notNull(), // warm | soft | deep | bright
  gender: text("gender"), // feminine | masculine | neutral (voice timbre, used for grammatical agreement)
  languages: text("languages").array().notNull(),
  settings: jsonb("settings"), // stability, similarity_boost, style
  ownerProfessionalId: uuid("owner_professional_id"),
  isActive: boolean("is_active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

export const experienceTypes = pgTable("experience_types", {
  id: text("id").primaryKey(), // matches technique registry ids
  category: text("category").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

/** Reusable session templates. System templates come from the registry; professionals create their own. */
export const experienceTemplates = pgTable("experience_templates", {
  id: id(),
  techniqueId: text("technique_id").notNull(),
  professionalId: uuid("professional_id"),
  title: text("title").notNull(),
  language: text("language").notNull(),
  durationMin: integer("duration_min").notNull(),
  narratorInstructions: text("narrator_instructions"),
  voicePresetId: text("voice_preset_id"),
  ambientTrackId: text("ambient_track_id"),
  ambientVolume: integer("ambient_volume").notNull().default(18), // percent
  pauseLevel: text("pause_level").notNull().default("balanced"),
  /** Edited base scenario (segments with {{name}} placeholders) — null means "compose from technique". */
  baseSegments: jsonb("base_segments"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────────────────────── Scenarios & audio ───────────────────────── */

export const audioScenarios = pgTable(
  "audio_scenarios",
  {
    id: id(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    anonId: text("anon_id"),
    professionalId: uuid("professional_id"),
    templateId: uuid("template_id"),
    productId: uuid("product_id"),
    draftId: uuid("draft_id"),
    techniqueId: text("technique_id").notNull(),
    kind: text("kind").notNull(), // preview | full | sample
    language: text("language").notNull(),
    title: text("title").notNull(),
    durationMin: integer("duration_min").notNull(),
    settings: jsonb("settings").notNull(),
    source: text("source").notNull(), // llm | composer | editor
    status: text("status").notNull().default("draft"), // draft | validated | rejected
    validation: jsonb("validation"),
    programId: uuid("program_id"),
    programDay: integer("program_day"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("scen_owner_idx").on(t.ownerUserId), index("scen_anon_idx").on(t.anonId)],
);

export const audioSegments = pgTable(
  "audio_segments",
  {
    id: id(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => audioScenarios.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    segmentType: text("segment_type").notNull(),
    spokenText: text("spoken_text").notNull(),
    language: text("language").notNull(),
    voiceId: text("voice_id").notNull(),
    pauseBeforeMs: integer("pause_before_ms").notNull().default(0),
    pauseAfterMs: integer("pause_after_ms").notNull().default(0),
    pauseFixed: boolean("pause_fixed").notNull().default(false),
    phase: text("phase").notNull().default("arrival"),
    ambientTrackId: text("ambient_track_id"),
    ambientVolume: integer("ambient_volume").notNull().default(0),
    speed: integer("speed").notNull().default(100), // percent of natural speed
    cacheKey: text("cache_key"),
    durationMs: integer("duration_ms"),
  },
  (t) => [uniqueIndex("seg_scenario_idx_uq").on(t.scenarioId, t.idx)],
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: id(),
    kind: text("kind").notNull(), // full | studio_sample
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => audioScenarios.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"), // queued | synthesizing | assembling | completed | failed | cancelled
    progress: integer("progress").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAfter: ts("run_after").notNull().defaultNow(),
    lockedAt: ts("locked_at"),
    lockedBy: text("locked_by"),
    error: text("error"),
    idempotencyKey: text("idempotency_key").notNull(),
    entitlementId: uuid("entitlement_id"),
    creditRefunded: boolean("credit_refunded").notNull().default(false),
    estimatedChars: integer("estimated_chars").notNull().default(0),
    generatedAudioId: uuid("generated_audio_id"),
    createdAt: createdAt(),
    finishedAt: ts("finished_at"),
  },
  (t) => [
    uniqueIndex("jobs_idem_uq").on(t.idempotencyKey),
    index("jobs_status_idx").on(t.status, t.runAfter),
  ],
);

export const generatedAudio = pgTable(
  "generated_audio",
  {
    id: id(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => audioScenarios.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    anonId: text("anon_id"),
    kind: text("kind").notNull(), // preview | full | sample
    storageKey: text("storage_key").notNull(),
    durationMs: integer("duration_ms").notNull(),
    bytes: integer("bytes").notNull(),
    format: text("format").notNull().default("mp3"),
    ttsProvider: text("tts_provider").notNull(),
    isDemoAudio: boolean("is_demo_audio").notNull().default(false),
    expiresAt: ts("expires_at"),
    createdAt: createdAt(),
  },
  (t) => [index("ga_owner_idx").on(t.ownerUserId), index("ga_anon_idx").on(t.anonId)],
);

export const experienceLibrary = pgTable(
  "experience_library",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    generatedAudioId: uuid("generated_audio_id")
      .notNull()
      .references(() => generatedAudio.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    techniqueId: text("technique_id").notNull(),
    source: text("source").notNull().default("generated"), // generated | purchase | share | preview
    productId: uuid("product_id"),
    programId: uuid("program_id"),
    programDay: integer("program_day"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    saved: boolean("saved").notNull().default(true),
    lastPositionMs: integer("last_position_ms").notNull().default(0),
    lastPlayedAt: ts("last_played_at"),
    playCount: integer("play_count").notNull().default(0),
    completedCount: integer("completed_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("lib_user_audio_uq").on(t.userId, t.generatedAudioId), index("lib_user_idx").on(t.userId)],
);

export const ttsCache = pgTable("tts_cache", {
  cacheKey: text("cache_key").primaryKey(),
  storageKey: text("storage_key").notNull(),
  durationMs: integer("duration_ms").notNull(),
  chars: integer("chars").notNull(),
  provider: text("provider").notNull(),
  createdAt: createdAt(),
  lastUsedAt: ts("last_used_at").notNull().defaultNow(),
});

export const usageLedger = pgTable(
  "usage_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    provider: text("provider").notNull(), // elevenlabs | anthropic
    purpose: text("purpose").notNull(), // preview | full | studio_sample | script
    units: integer("units").notNull(), // characters or tokens
    estCostMicrousd: integer("est_cost_microusd").notNull().default(0),
    userId: uuid("user_id"),
    anonId: text("anon_id"),
    jobId: uuid("job_id"),
    cached: boolean("cached").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("usage_created_idx").on(t.createdAt), index("usage_user_idx").on(t.userId)],
);

/* ───────────────────────── Programs ───────────────────────── */

export const programs = pgTable("programs", {
  id: id(),
  key: text("key").unique(), // system programs, e.g. 'seven-days-relaxation'
  professionalId: uuid("professional_id"),
  title: text("title").notNull(),
  description: text("description"),
  language: text("language"),
  days: integer("days").notNull(),
  createdAt: createdAt(),
});

export const programSessions = pgTable(
  "program_sessions",
  {
    id: id(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(), // 1-based
    techniqueId: text("technique_id").notNull(),
    title: text("title").notNull(),
    durationMin: integer("duration_min").notNull(),
    templateId: uuid("template_id"),
    focus: text("focus"),
  },
  (t) => [uniqueIndex("ps_program_day_uq").on(t.programId, t.dayIndex)],
);

export const programProgress = pgTable(
  "program_progress",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    productId: uuid("product_id"),
    currentDay: integer("current_day").notNull().default(1),
    completedDays: integer("completed_days").array().notNull().default(sql`'{}'::int[]`),
    settings: jsonb("settings"),
    startedAt: createdAt(),
    lastSessionAt: ts("last_session_at"),
    completedAt: ts("completed_at"),
  },
  (t) => [uniqueIndex("pp_user_program_uq").on(t.userId, t.programId)],
);

/* ───────────────────────── Studio (B2B) ───────────────────────── */

export const professionalProfiles = pgTable("professional_profiles", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  slug: text("slug").notNull().unique(),
  profession: text("profession").notNull(), // psychologist | psychotherapist | coach | yoga_teacher | mindfulness_trainer | wellness | performance_coach
  headline: text("headline"),
  bio: text("bio"),
  credentials: text("credentials"),
  website: text("website"),
  brandColor: text("brand_color"),
  verificationStatus: text("verification_status").notNull().default("unverified"), // unverified | pending | verified
  plan: text("plan").notNull().default("starter"), // starter | pro
  clinicalMode: boolean("clinical_mode").notNull().default(false), // share-without-sale for psychologists/therapists
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const professionalStores = pgTable("professional_stores", {
  id: id(),
  professionalId: uuid("professional_id")
    .notNull()
    .unique()
    .references(() => professionalProfiles.id, { onDelete: "cascade" }),
  isPublic: boolean("is_public").notNull().default(true),
  stripeAccountId: text("stripe_account_id"),
  stripeOnboardingStatus: text("stripe_onboarding_status").notNull().default("not_started"), // not_started | pending | complete
  chargesEnabled: boolean("charges_enabled").notNull().default(false),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  createdAt: createdAt(),
});

export const voiceCloneRequests = pgTable("voice_clone_requests", {
  id: id(),
  professionalId: uuid("professional_id")
    .notNull()
    .references(() => professionalProfiles.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending_verification"), // pending_verification | verified | rejected | active | revoked
  consentStatement: text("consent_statement").notNull(),
  consentedAt: ts("consented_at").notNull(),
  identityVerifiedAt: ts("identity_verified_at"),
  voicePresetId: text("voice_preset_id"),
  createdAt: createdAt(),
});

export const products = pgTable(
  "products",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    type: text("type").notNull(), // single | program | bundle
    title: text("title").notNull(),
    description: text("description").notNull(),
    language: text("language").notNull(),
    techniqueId: text("technique_id").notNull(),
    templateId: uuid("template_id"),
    programId: uuid("program_id"),
    durationMin: integer("duration_min").notNull(),
    sessionsCount: integer("sessions_count").notNull().default(1),
    personalizationFields: text("personalization_fields").array().notNull().default(sql`'{}'::text[]`),
    isFree: boolean("is_free").notNull().default(false),
    status: text("status").notNull().default("draft"), // draft | pending_review | published | rejected | archived
    visibility: text("visibility").notNull().default("public"), // public | unlisted | private
    responsibilityAckAt: ts("responsibility_ack_at"),
    reviewNotes: text("review_notes"),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("products_pro_slug_uq").on(t.professionalId, t.slug)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(), // ISO lower-case: pln, eur, usd
    amountMinor: integer("amount_minor").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("pv_product_currency_uq").on(t.productId, t.currency)],
);

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: id(),
    code: text("code").notNull(),
    professionalId: uuid("professional_id"),
    productId: uuid("product_id"),
    percentOff: integer("percent_off"),
    maxRedemptions: integer("max_redemptions"),
    redeemedCount: integer("redeemed_count").notNull().default(0),
    expiresAt: ts("expires_at"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("dc_code_scope_uq").on(t.code, t.professionalId)],
);

/** Private shares (e.g. psychologist → client) without any sale. */
export const shareLinks = pgTable("share_links", {
  id: id(),
  professionalId: uuid("professional_id")
    .notNull()
    .references(() => professionalProfiles.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  note: text("note"), // professional's private label — no client PII required
  maxUses: integer("max_uses").notNull().default(1),
  uses: integer("uses").notNull().default(0),
  expiresAt: ts("expires_at"),
  revokedAt: ts("revoked_at"),
  createdAt: createdAt(),
});

/* ───────────────────────── Commerce ───────────────────────── */

/** Platform B2C offers (extend to 30 min, 5-pack, Personal Plan). Prices live in offer_prices. */
export const offers = pgTable("offers", {
  id: text("id").primaryKey(), // extend_30 | pack_5 | personal_plan | studio_pro
  kind: text("kind").notNull(), // one_time | subscription
  audience: text("audience").notNull().default("consumer"), // consumer | professional
  credits: integer("credits").notNull().default(0),
  maxDurationMin: integer("max_duration_min").notNull().default(30),
  interval: text("interval"), // month | year
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

export const offerPrices = pgTable(
  "offer_prices",
  {
    offerId: text("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    market: text("market").notNull(), // pl | eu | us | intl
    currency: text("currency").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    stripePriceId: text("stripe_price_id"),
  },
  (t) => [primaryKey({ columns: [t.offerId, t.market] })],
);

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

export const checkoutSessions = pgTable(
  "checkout_sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // stripe | demo
    providerSessionId: text("provider_session_id"),
    kind: text("kind").notNull(), // offer | product
    offerId: text("offer_id"),
    productId: uuid("product_id"),
    draftId: uuid("draft_id"),
    currency: text("currency").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    discountCodeId: uuid("discount_code_id"),
    status: text("status").notNull().default("open"), // open | completed | expired
    createdAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  (t) => [uniqueIndex("cs_provider_uq").on(t.provider, t.providerSessionId)],
);

export const purchases = pgTable(
  "purchases",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkoutSessionId: uuid("checkout_session_id").notNull(),
    kind: text("kind").notNull(),
    offerId: text("offer_id"),
    productId: uuid("product_id"),
    professionalId: uuid("professional_id"),
    currency: text("currency").notNull(),
    amountGrossMinor: integer("amount_gross_minor").notNull(),
    taxMinor: integer("tax_minor").notNull().default(0),
    providerPaymentId: text("provider_payment_id"),
    status: text("status").notNull().default("paid"), // paid | refunded
    createdAt: createdAt(),
  },
  // one purchase per checkout session = idempotent webhook handling, no double charge records
  (t) => [uniqueIndex("purchases_cs_uq").on(t.checkoutSessionId)],
);

export const subscriptions = pgTable("subscriptions", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  offerId: text("offer_id").notNull(), // personal_plan | studio_pro
  provider: text("provider").notNull(),
  providerSubscriptionId: text("provider_subscription_id").unique(),
  status: text("status").notNull(), // active | trialing | past_due | canceled
  currentPeriodEnd: ts("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const entitlements = pgTable(
  "entitlements",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // free_trial | purchase | subscription | share | grant
    kind: text("kind").notNull(), // session_credits | product_access | plan_access
    purchaseId: uuid("purchase_id"),
    subscriptionId: uuid("subscription_id"),
    productId: uuid("product_id"),
    shareLinkId: uuid("share_link_id"),
    creditsTotal: integer("credits_total").notNull().default(0),
    creditsUsed: integer("credits_used").notNull().default(0),
    maxDurationMin: integer("max_duration_min").notNull().default(5),
    validUntil: ts("valid_until"),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index("ent_user_idx").on(t.userId)],
);

export const platformCommissions = pgTable("platform_commissions", {
  id: id(),
  purchaseId: uuid("purchase_id").notNull().unique(),
  professionalId: uuid("professional_id").notNull(),
  rateBps: integer("rate_bps").notNull(),
  netMinor: integer("net_minor").notNull(),
  platformMinor: integer("platform_minor").notNull(),
  authorMinor: integer("author_minor").notNull(),
  currency: text("currency").notNull(),
  payoutId: uuid("payout_id"),
  status: text("status").notNull().default("accrued"), // accrued | in_payout | paid_out | reversed
  createdAt: createdAt(),
});

export const payouts = pgTable("payouts", {
  id: id(),
  professionalId: uuid("professional_id").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("held"), // held | pending | paid | failed
  holdReason: text("hold_reason"),
  providerTransferId: text("provider_transfer_id"),
  createdAt: createdAt(),
});

/* ───────────────────────── Platform ───────────────────────── */

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    userId: uuid("user_id"),
    anonId: text("anon_id"),
    professionalId: uuid("professional_id"),
    productId: uuid("product_id"),
    techniqueId: text("technique_id"),
    locale: text("locale"),
    props: jsonb("props"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ae_name_created_idx").on(t.name, t.createdAt),
    index("ae_pro_idx").on(t.professionalId, t.name),
    index("ae_user_idx").on(t.userId, t.createdAt),
  ],
);

/** Optional DB overrides for localized copy (admin-editable), falls back to bundled messages. */
export const localizationContent = pgTable(
  "localization_content",
  {
    id: id(),
    namespace: text("namespace").notNull(),
    key: text("key").notNull(),
    locale: text("locale").notNull(),
    value: text("value").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("lc_uq").on(t.namespace, t.key, t.locale)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const moderationFlags = pgTable("moderation_flags", {
  id: id(),
  entityType: text("entity_type").notNull(), // scenario | product | input
  entityId: text("entity_id").notNull(),
  reason: text("reason").notNull(),
  details: jsonb("details"),
  status: text("status").notNull().default("open"), // open | resolved | dismissed
  createdAt: createdAt(),
});
