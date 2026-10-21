CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_id" uuid,
	"anon_id" text,
	"professional_id" uuid,
	"product_id" uuid,
	"technique_id" text,
	"locale" text,
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"anon_id" text,
	"professional_id" uuid,
	"template_id" uuid,
	"product_id" uuid,
	"draft_id" uuid,
	"technique_id" text NOT NULL,
	"kind" text NOT NULL,
	"language" text NOT NULL,
	"title" text NOT NULL,
	"duration_min" integer NOT NULL,
	"settings" jsonb NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"validation" jsonb,
	"program_id" uuid,
	"program_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"segment_type" text NOT NULL,
	"spoken_text" text NOT NULL,
	"language" text NOT NULL,
	"voice_id" text NOT NULL,
	"pause_before_ms" integer DEFAULT 0 NOT NULL,
	"pause_after_ms" integer DEFAULT 0 NOT NULL,
	"pause_fixed" boolean DEFAULT false NOT NULL,
	"phase" text DEFAULT 'arrival' NOT NULL,
	"ambient_track_id" text,
	"ambient_volume" integer DEFAULT 0 NOT NULL,
	"speed" integer DEFAULT 100 NOT NULL,
	"cache_key" text,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "checkout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_session_id" text,
	"kind" text NOT NULL,
	"offer_id" text,
	"product_id" uuid,
	"draft_id" uuid,
	"currency" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"discount_code_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"granted" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"professional_id" uuid,
	"product_id" uuid,
	"percent_off" integer,
	"max_redemptions" integer,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"purchase_id" uuid,
	"subscription_id" uuid,
	"product_id" uuid,
	"share_link_id" uuid,
	"credits_total" integer DEFAULT 0 NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"max_duration_min" integer DEFAULT 5 NOT NULL,
	"valid_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experience_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anon_id" text,
	"user_id" uuid,
	"technique_id" text NOT NULL,
	"product_id" uuid,
	"ui_locale" text NOT NULL,
	"settings" jsonb NOT NULL,
	"preview_audio_id" uuid,
	"preview_count" integer DEFAULT 0 NOT NULL,
	"program_id" uuid,
	"program_day" integer,
	"full_scenario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experience_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"generated_audio_id" uuid NOT NULL,
	"title" text NOT NULL,
	"technique_id" text NOT NULL,
	"source" text DEFAULT 'generated' NOT NULL,
	"product_id" uuid,
	"program_id" uuid,
	"program_day" integer,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"saved" boolean DEFAULT true NOT NULL,
	"last_position_ms" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	"play_count" integer DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experience_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technique_id" text NOT NULL,
	"professional_id" uuid,
	"title" text NOT NULL,
	"language" text NOT NULL,
	"duration_min" integer NOT NULL,
	"narrator_instructions" text,
	"voice_preset_id" text,
	"ambient_track_id" text,
	"ambient_volume" integer DEFAULT 18 NOT NULL,
	"pause_level" text DEFAULT 'balanced' NOT NULL,
	"base_segments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experience_types" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_audio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"anon_id" text,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"bytes" integer NOT NULL,
	"format" text DEFAULT 'mp3' NOT NULL,
	"tts_provider" text NOT NULL,
	"is_demo_audio" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"scenario_id" uuid NOT NULL,
	"user_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"error" text,
	"idempotency_key" text NOT NULL,
	"entitlement_id" uuid,
	"credit_refunded" boolean DEFAULT false NOT NULL,
	"estimated_chars" integer DEFAULT 0 NOT NULL,
	"generated_audio_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "localization_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace" text NOT NULL,
	"key" text NOT NULL,
	"locale" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_prices" (
	"offer_id" text NOT NULL,
	"market" text NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"stripe_price_id" text,
	CONSTRAINT "offer_prices_offer_id_market_pk" PRIMARY KEY("offer_id","market")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"audience" text DEFAULT 'consumer' NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"max_duration_min" integer DEFAULT 30 NOT NULL,
	"interval" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"hold_reason" text,
	"provider_transfer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_context_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"detail" text,
	"tone" text DEFAULT 'neutral' NOT NULL,
	"allowed_categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"involves_third_party" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personalization_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"first_name" text,
	"name_vocative" text,
	"recording_language" text,
	"voice_preset_id" text,
	"favorite_place" text,
	"imagined_setting" text,
	"listening_environment" text,
	"ambient_sounds" text[],
	"narration_speed" text DEFAULT 'calm' NOT NULL,
	"pause_level" text DEFAULT 'balanced' NOT NULL,
	"default_duration_min" integer DEFAULT 10 NOT NULL,
	"ambient_track_id" text,
	"personalization_level" text DEFAULT 'balanced' NOT NULL,
	"style" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"rate_bps" integer NOT NULL,
	"net_minor" integer NOT NULL,
	"platform_minor" integer NOT NULL,
	"author_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"payout_id" uuid,
	"status" text DEFAULT 'accrued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_commissions_purchase_id_unique" UNIQUE("purchase_id")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"language" text NOT NULL,
	"technique_id" text NOT NULL,
	"template_id" uuid,
	"program_id" uuid,
	"duration_min" integer NOT NULL,
	"sessions_count" integer DEFAULT 1 NOT NULL,
	"personalization_fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"responsibility_ack_at" timestamp with time zone,
	"review_notes" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"slug" text NOT NULL,
	"profession" text NOT NULL,
	"headline" text,
	"bio" text,
	"credentials" text,
	"website" text,
	"brand_color" text,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"plan" text DEFAULT 'starter' NOT NULL,
	"clinical_mode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "professional_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "professional_stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"stripe_account_id" text,
	"stripe_onboarding_status" text DEFAULT 'not_started' NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_stores_professional_id_unique" UNIQUE("professional_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"first_name" text,
	"timezone" text,
	"reminders_enabled" boolean DEFAULT false NOT NULL,
	"reminder_time" text,
	"reminder_days" text[],
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"product_id" uuid,
	"current_day" integer DEFAULT 1 NOT NULL,
	"completed_days" integer[] DEFAULT '{}'::int[] NOT NULL,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_session_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "program_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"day_index" integer NOT NULL,
	"technique_id" text NOT NULL,
	"title" text NOT NULL,
	"duration_min" integer NOT NULL,
	"template_id" uuid,
	"focus" text
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text,
	"professional_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"language" text,
	"days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"checkout_session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"offer_id" text,
	"product_id" uuid,
	"professional_id" uuid,
	"currency" text NOT NULL,
	"amount_gross_minor" integer NOT NULL,
	"tax_minor" integer DEFAULT 0 NOT NULL,
	"provider_payment_id" text,
	"status" text DEFAULT 'paid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"token" text NOT NULL,
	"note" text,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"offer_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_subscription_id" text,
	"status" text NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_provider_subscription_id_unique" UNIQUE("provider_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "tts_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"storage_key" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"chars" integer NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"purpose" text NOT NULL,
	"units" integer NOT NULL,
	"est_cost_microusd" integer DEFAULT 0 NOT NULL,
	"user_id" uuid,
	"anon_id" text,
	"job_id" uuid,
	"cached" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider" text NOT NULL,
	"auth_subject" text NOT NULL,
	"email" text,
	"ui_locale" text DEFAULT 'en' NOT NULL,
	"market" text DEFAULT 'intl' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"free_session_granted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "voice_clone_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"consent_statement" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"identity_verified_at" timestamp with time zone,
	"voice_preset_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'elevenlabs' NOT NULL,
	"provider_voice_id" text NOT NULL,
	"label" text NOT NULL,
	"character" text NOT NULL,
	"gender" text,
	"languages" text[] NOT NULL,
	"settings" jsonb,
	"owner_professional_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audio_scenarios" ADD CONSTRAINT "audio_scenarios_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_segments" ADD CONSTRAINT "audio_segments_scenario_id_audio_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."audio_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_drafts" ADD CONSTRAINT "experience_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_library" ADD CONSTRAINT "experience_library_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_library" ADD CONSTRAINT "experience_library_generated_audio_id_generated_audio_id_fk" FOREIGN KEY ("generated_audio_id") REFERENCES "public"."generated_audio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_audio" ADD CONSTRAINT "generated_audio_scenario_id_audio_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."audio_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_audio" ADD CONSTRAINT "generated_audio_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_scenario_id_audio_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."audio_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_prices" ADD CONSTRAINT "offer_prices_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_context_items" ADD CONSTRAINT "personal_context_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personalization_profiles" ADD CONSTRAINT "personalization_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_professional_id_professional_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professional_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_stores" ADD CONSTRAINT "professional_stores_professional_id_professional_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professional_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_progress" ADD CONSTRAINT "program_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_progress" ADD CONSTRAINT "program_progress_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_sessions" ADD CONSTRAINT "program_sessions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_professional_id_professional_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professional_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_clone_requests" ADD CONSTRAINT "voice_clone_requests_professional_id_professional_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professional_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ae_name_created_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "ae_pro_idx" ON "analytics_events" USING btree ("professional_id","name");--> statement-breakpoint
CREATE INDEX "ae_user_idx" ON "analytics_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "scen_owner_idx" ON "audio_scenarios" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "scen_anon_idx" ON "audio_scenarios" USING btree ("anon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seg_scenario_idx_uq" ON "audio_segments" USING btree ("scenario_id","idx");--> statement-breakpoint
CREATE UNIQUE INDEX "cs_provider_uq" ON "checkout_sessions" USING btree ("provider","provider_session_id");--> statement-breakpoint
CREATE INDEX "consents_user_idx" ON "consents" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "dc_code_scope_uq" ON "discount_codes" USING btree ("code","professional_id");--> statement-breakpoint
CREATE INDEX "ent_user_idx" ON "entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "drafts_anon_idx" ON "experience_drafts" USING btree ("anon_id");--> statement-breakpoint
CREATE INDEX "drafts_user_idx" ON "experience_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lib_user_audio_uq" ON "experience_library" USING btree ("user_id","generated_audio_id");--> statement-breakpoint
CREATE INDEX "lib_user_idx" ON "experience_library" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ga_owner_idx" ON "generated_audio" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "ga_anon_idx" ON "generated_audio" USING btree ("anon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_idem_uq" ON "generation_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "generation_jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "lc_uq" ON "localization_content" USING btree ("namespace","key","locale");--> statement-breakpoint
CREATE INDEX "pci_user_idx" ON "personal_context_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pv_product_currency_uq" ON "product_variants" USING btree ("product_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "products_pro_slug_uq" ON "products" USING btree ("professional_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "pp_user_program_uq" ON "program_progress" USING btree ("user_id","program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ps_program_day_uq" ON "program_sessions" USING btree ("program_id","day_index");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_cs_uq" ON "purchases" USING btree ("checkout_session_id");--> statement-breakpoint
CREATE INDEX "usage_created_idx" ON "usage_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "usage_user_idx" ON "usage_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_uq" ON "users" USING btree ("auth_provider","auth_subject");