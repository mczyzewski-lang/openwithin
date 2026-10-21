"use client";

import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { LOCALE_CONFIG } from "@/i18n/locales";
import { routing } from "@/i18n/routing";

/** Switches UI language. Pages with localized slugs pass explicit alternates. */
export function LocaleSwitcher({ alternates, dark }: { alternates?: Partial<Record<string, string>>; dark?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const hrefFor = (l: string) => alternates?.[l] ?? pathname.replace(new RegExp(`^/${locale}(?=/|$)`), `/${l}`);
  return (
    <div className={`flex items-center gap-1 text-xs ${dark ? "text-night/60" : "text-slate"}`}>
      <Globe className="h-3.5 w-3.5" aria-hidden />
      {routing.locales.map((l) => (
        <a
          key={l}
          href={hrefFor(l)}
          hrefLang={l}
          onClick={() => (document.cookie = `ow_locale=${l};path=/;max-age=31536000;samesite=lax`)}
          className={`rounded px-1.5 py-0.5 uppercase ${l === locale ? (dark ? "text-night" : "text-champagne") : "hover:opacity-80"}`}
          aria-current={l === locale ? "true" : undefined}
          title={LOCALE_CONFIG[l].label}
        >
          {l}
        </a>
      ))}
    </div>
  );
}
