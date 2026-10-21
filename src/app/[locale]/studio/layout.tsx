import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/layout/Logo";
import { Link } from "@/i18n/navigation";
import { getCurrentUser, getProfessional } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("studio");
  const user = await getCurrentUser();
  const pro = user ? await getProfessional(user.id) : null;
  const nav = [
    ["/studio", t("nav.overview")],
    ["/studio/experiences", t("nav.experiences")],
    ["/studio/new", t("nav.create")],
    ["/studio/store", t("nav.store")],
    ["/studio/analytics", t("nav.analytics")],
    ["/studio/settings", t("nav.settings")],
  ] as const;
  return (
    <div className="studio min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-night/8 bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3">
            <Logo dark href="/studio" />
            <span className="rounded-full bg-night px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-ivory">Studio</span>
          </div>
          <Link href="/space" className="text-sm text-night/60 hover:text-night">{t("nav.back")}</Link>
        </div>
        {pro && (
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 pb-2 text-sm [scrollbar-width:none]">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className="shrink-0 rounded-full px-3.5 py-1.5 text-night/70 hover:bg-night/5 hover:text-night">
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-10">{children}</div>
    </div>
  );
}
