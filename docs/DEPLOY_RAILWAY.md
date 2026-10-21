# Deploy on Railway

Layout: **one service** (this repo) + **volume mounted at `/data`** + **Postgres**.
The web app and the audio worker run in the same container (`scripts/start.sh`), because
the volume can be attached to one service only. Migrations and seed run on every start (idempotent).

## Steps
1. **New Project → Deploy from GitHub repo** → `mczyzewski-lang/openwithin` (branch of your choice).
   Railway picks up `railway.json` → builds with the `Dockerfile` (includes FFmpeg), healthcheck `/api/health`.
2. In the project: **+ Create → Database → PostgreSQL**.
3. On the app service: **Settings → Volumes → Add volume**, mount path **`/data`**.
4. **Settings → Networking → Generate domain** (or add `openwithin.app`). Put that URL into `APP_URL`.
5. **Variables → Raw Editor** → paste the block below, fill in the keys → **Deploy**.

## Raw variables
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_URL=https://YOUR-DOMAIN
APP_SECRET=PASTE_OUTPUT_OF__openssl_rand_-base64_48
NODE_ENV=production

STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=/data/storage
INLINE_WORKER=false

ELEVENLABS_API_KEY=
ELEVENLABS_MODEL_FULL=eleven_multilingual_v2
ELEVENLABS_MODEL_PREVIEW=eleven_flash_v2_5

LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
LLM_MODEL=claude-opus-5-5

STRIPE_SECRET_KEY=sk_test_
STRIPE_WEBHOOK_SECRET=whsec_
MARKETPLACE_PAYOUTS_ENABLED=false

# Sign-in (Google / Apple / e-mail link). Supabase is used ONLY for auth here — data stays in Railway Postgres.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_APPLE_ENABLED=false

# Until Supabase is configured you can test with demo sign-in/checkout. Turn OFF before real users.
DEMO_MODE=false

PREVIEW_MAX_PER_ANON=3
PREVIEW_MAX_PER_IP_HOUR=6
PREVIEW_GLOBAL_DAILY=2000
TTS_DAILY_CHAR_BUDGET=2000000
```

## After the first deploy
* **Supabase Auth**: Authentication → URL configuration → add `https://YOUR-DOMAIN/auth/callback` to redirect URLs;
  enable Email and Google (Apple optional → then `AUTH_APPLE_ENABLED=true`).
* **Stripe webhook**: endpoint `https://YOUR-DOMAIN/api/stripe/webhook` with events
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`,
  `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `account.updated`
  → copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
* **Admin**: in Railway Postgres → Data/Query: `update users set is_admin = true where email = 'you@…';` → `/pl/admin`.
* Changing `APP_URL` requires a redeploy (it is baked into static pages, canonical and hreflang).
