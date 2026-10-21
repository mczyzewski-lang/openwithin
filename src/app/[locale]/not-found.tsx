import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BreathingLight } from "@/components/ui/BreathingLight";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <BreathingLight size={110} />
      <h1 className="mt-8 text-3xl text-ivory">{t("notFound")}</h1>
      <Link href="/" className="btn-ghost mt-8">{t("home")}</Link>
    </main>
  );
}
