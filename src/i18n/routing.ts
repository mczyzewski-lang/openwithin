import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, UI_LOCALES } from "./locales";

export const routing = defineRouting({
  locales: UI_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  localeCookie: { name: "ow_locale", maxAge: 60 * 60 * 24 * 365 },
});
