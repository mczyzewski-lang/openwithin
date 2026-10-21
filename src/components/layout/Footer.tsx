import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";

export async function Footer({ alternates }: { alternates?: Partial<Record<string, string>> }) {
  const t = await getTranslations("footer");
  return (
    <footer className="border-t border-ivory/5 bg-night">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed text-slate">{t("tagline")}</p>
          <LocaleSwitcher alternates={alternates} />
        </div>
        <div className="space-y-3 text-sm">
          <p className="eyebrow">{t("product")}</p>
          <Link href="/explore" className="block text-ivory/75 hover:text-champagne">{t("explore")}</Link>
          <Link href="/plans" className="block text-ivory/75 hover:text-champagne">{t("plans")}</Link>
          <Link href="/studio" className="block text-ivory/75 hover:text-champagne">{t("studio")}</Link>
        </div>
        <div className="space-y-3 text-sm">
          <p className="eyebrow">{t("legal")}</p>
          <Link href="/legal/privacy" className="block text-ivory/75 hover:text-champagne">{t("privacy")}</Link>
          <Link href="/legal/terms" className="block text-ivory/75 hover:text-champagne">{t("terms")}</Link>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 pb-10 text-xs leading-relaxed text-slate-2">{t("disclaimer")}</div>
    </footer>
  );
}
