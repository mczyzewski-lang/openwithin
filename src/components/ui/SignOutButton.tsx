"use client";

import { useTranslations } from "next-intl";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("nav");
  return (
    <button
      className={className}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
      }}
    >
      {t("signOut")}
    </button>
  );
}
