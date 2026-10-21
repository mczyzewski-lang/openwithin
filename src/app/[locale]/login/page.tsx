import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/funnel/LoginForm";
import { Header } from "@/components/layout/Header";
import { BreathingLight } from "@/components/ui/BreathingLight";
import { getCurrentUser } from "@/server/auth/session";
import { env, features } from "@/server/env";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: `${t("title")} · OpenWithin`, robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string; error?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/space`;
  if (await getCurrentUser()) redirect(safeNext);
  const t = await getTranslations("login");
  const fromFunnel = safeNext.includes("/continue/");
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-8 flex justify-center">
          <BreathingLight size={96} />
        </div>
        <h1 className="text-center text-3xl text-ivory">{fromFunnel ? t("funnelTitle") : t("title")}</h1>
        <p className="mt-3 text-center text-slate">{fromFunnel ? t("funnelSubtitle") : t("subtitle")}</p>
        {error && <p className="mt-6 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-center text-sm">{t("error")}</p>}
        <div className="mt-8">
          <LoginForm
            next={safeNext}
            mode={features.supabaseAuth ? "supabase" : features.demoAuth ? "demo" : "unconfigured"}
            appleEnabled={env.AUTH_APPLE_ENABLED}
            supabaseUrl={env.NEXT_PUBLIC_SUPABASE_URL}
            supabaseAnonKey={env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
          />
        </div>
      </main>
    </>
  );
}
