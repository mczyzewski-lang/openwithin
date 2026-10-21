"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function DemoPayButton({ checkoutId, done }: { checkoutId: string; done: boolean }) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "paying" | "done">(done ? "done" : "idle");
  async function pay() {
    setState("paying");
    const res = await fetch("/api/checkout/demo/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutId }) });
    if (res.ok) {
      setState("done");
      router.push(`/space?checkout=${checkoutId}`);
    } else setState("idle");
  }
  if (state === "done") return <button className="btn-primary w-full" onClick={() => router.push("/space")}>{t("goToSpace")}</button>;
  return (
    <button className="btn-primary w-full" disabled={state === "paying"} onClick={pay}>
      {state === "paying" ? t("processing") : t("simulate")}
    </button>
  );
}
