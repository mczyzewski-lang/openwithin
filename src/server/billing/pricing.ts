import "server-only";
import { asc, eq } from "drizzle-orm";
import { LOCALE_CONFIG, MARKET_CURRENCY, type LocaleCode, type Market } from "@/i18n/locales";
import { db, schema } from "../db";

/** Initial experimental prices — seeded into offer_prices and editable in /admin. Never hard-code in UI. */
export const SEED_OFFERS = [
  { id: "extend_30", kind: "one_time", audience: "consumer", credits: 1, maxDurationMin: 30, interval: null, sort: 1 },
  { id: "pack_5", kind: "one_time", audience: "consumer", credits: 5, maxDurationMin: 30, interval: null, sort: 2 },
  { id: "personal_plan", kind: "subscription", audience: "consumer", credits: 20, maxDurationMin: 45, interval: "month", sort: 3 },
  { id: "studio_pro", kind: "subscription", audience: "professional", credits: 0, maxDurationMin: 60, interval: "month", sort: 10 },
] as const;

export const SEED_PRICES: { offerId: string; market: Market; currency: string; amountMinor: number }[] = [
  { offerId: "extend_30", market: "pl", currency: "pln", amountMinor: 2900 },
  { offerId: "pack_5", market: "pl", currency: "pln", amountMinor: 7900 },
  { offerId: "personal_plan", market: "pl", currency: "pln", amountMinor: 4900 },
  { offerId: "studio_pro", market: "pl", currency: "pln", amountMinor: 9900 },
  { offerId: "extend_30", market: "eu", currency: "eur", amountMinor: 699 },
  { offerId: "pack_5", market: "eu", currency: "eur", amountMinor: 1899 },
  { offerId: "personal_plan", market: "eu", currency: "eur", amountMinor: 1199 },
  { offerId: "studio_pro", market: "eu", currency: "eur", amountMinor: 2499 },
  { offerId: "extend_30", market: "us", currency: "usd", amountMinor: 699 },
  { offerId: "pack_5", market: "us", currency: "usd", amountMinor: 1999 },
  { offerId: "personal_plan", market: "us", currency: "usd", amountMinor: 1199 },
  { offerId: "studio_pro", market: "us", currency: "usd", amountMinor: 2499 },
  { offerId: "extend_30", market: "intl", currency: "usd", amountMinor: 699 },
  { offerId: "pack_5", market: "intl", currency: "usd", amountMinor: 1999 },
  { offerId: "personal_plan", market: "intl", currency: "usd", amountMinor: 1199 },
  { offerId: "studio_pro", market: "intl", currency: "usd", amountMinor: 2499 },
];

export const DEFAULT_COMMISSION = { starter: 3000, pro: 1500 }; // basis points kept by the platform

export function marketForLocale(locale: string, override?: string | null): Market {
  if (override && ["pl", "eu", "us", "intl"].includes(override)) return override as Market;
  return LOCALE_CONFIG[(locale as LocaleCode) in LOCALE_CONFIG ? (locale as LocaleCode) : "en"].defaultMarket;
}

export function currencyForMarket(market: Market) {
  return MARKET_CURRENCY[market];
}

export interface PricedOffer {
  id: string;
  kind: string;
  credits: number;
  maxDurationMin: number;
  interval: string | null;
  currency: string;
  amountMinor: number;
}

export async function offersForMarket(market: Market, audience = "consumer"): Promise<PricedOffer[]> {
  const rows = await db
    .select({ offer: schema.offers, price: schema.offerPrices })
    .from(schema.offers)
    .innerJoin(schema.offerPrices, eq(schema.offerPrices.offerId, schema.offers.id))
    .where(eq(schema.offerPrices.market, market))
    .orderBy(asc(schema.offers.sort));
  return rows
    .filter((r) => r.offer.active && r.offer.audience === audience)
    .map((r) => ({
      id: r.offer.id,
      kind: r.offer.kind,
      credits: r.offer.credits,
      maxDurationMin: r.offer.maxDurationMin,
      interval: r.offer.interval,
      currency: r.price.currency,
      amountMinor: r.price.amountMinor,
    }));
}

export async function commissionRates(): Promise<{ starter: number; pro: number }> {
  const [row] = await db.select().from(schema.platformSettings).where(eq(schema.platformSettings.key, "commission_bps"));
  return { ...DEFAULT_COMMISSION, ...((row?.value as object) ?? {}) };
}

/** Split of net revenue between platform and author. Rounds in the author's favour. */
export function splitRevenue(netMinor: number, rateBps: number) {
  const platform = Math.floor((netMinor * rateBps) / 10_000);
  return { platform, author: netMinor - platform };
}
