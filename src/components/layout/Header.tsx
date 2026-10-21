import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AccountLink } from "./AccountLink";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";

export async function Header({ alternates, transparent = false }: { alternates?: Partial<Record<string, string>>; transparent?: boolean }) {
  const t = await getTranslations("nav");
  return (
    <header className={`${transparent ? "absolute inset-x-0 top-0 z-30" : "sticky top-0 z-30 border-b border-ivory/5 bg-night/85 backdrop-blur-md"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="flex items-center gap-5 text-sm text-ivory/75">
          <Link href="/explore" className="hidden hover:text-champagne sm:inline">
            {t("explore")}
          </Link>
          <Link href="/studio" className="hidden hover:text-champagne sm:inline">
            {t("studio")}
          </Link>
          <div className="hidden md:block">
            <LocaleSwitcher alternates={alternates} />
          </div>
          <AccountLink />
        </nav>
      </div>
    </header>
  );
}
