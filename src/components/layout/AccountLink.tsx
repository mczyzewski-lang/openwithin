"use client";

import { useTranslations } from "next-intl";
import { UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useSession } from "./useSession";

export function AccountLink() {
  const t = useTranslations("nav");
  const session = useSession();
  if (session?.signedIn) {
    return (
      <Link href="/space" className="inline-flex items-center gap-2 rounded-full border border-ivory/15 px-4 py-2 hover:border-champagne/60">
        <UserRound className="h-4 w-4" aria-hidden />
        <span>{t("yourSpace")}</span>
      </Link>
    );
  }
  return (
    <Link href="/login" className={`rounded-full border border-ivory/15 px-4 py-2 transition hover:border-champagne/60 ${session ? "opacity-100" : "opacity-0"}`}>
      {t("signIn")}
    </Link>
  );
}
