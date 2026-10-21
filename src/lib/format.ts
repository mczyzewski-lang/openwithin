import { LOCALE_CONFIG, type LocaleCode } from "@/i18n/locales";

export function formatMoney(amountMinor: number, currency: string, locale: string): string {
  const bcp = LOCALE_CONFIG[(locale as LocaleCode) in LOCALE_CONFIG ? (locale as LocaleCode) : "en"].bcp47;
  return new Intl.NumberFormat(bcp, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2 }).format(amountMinor / 100);
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
