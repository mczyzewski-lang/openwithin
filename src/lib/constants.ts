/** Used only when APP_SECRET is not set outside production. Production refuses to start with it. */
export const DEV_APP_SECRET = "dev-only-secret-change-me-please-32b";

/** First path segments owned by the app — professional store slugs may not use them. */
export const RESERVED_SEGMENTS = [
  "api", "auth", "_next", "studio", "space", "login", "create", "explore", "profile", "plans", "programs",
  "checkout", "continue", "experience", "store", "share", "admin", "legal", "sitemap.xml", "robots.txt",
  "favicon.ico", "icon", "apple-icon", "manifest.webmanifest", "opengraph-image", "about", "help", "support",
] as const;
