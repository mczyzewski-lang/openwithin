"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { BreathingLight } from "../ui/BreathingLight";

type State =
  | { kind: "starting" }
  | { kind: "running"; jobId: string; progress: number; status: string }
  | { kind: "needs_purchase" }
  | { kind: "failed" }
  | { kind: "error"; code: string };

/** Queues the full session and follows the background job until the recording is ready. */
export function FullExperience({ draftId, durationMin, regenerate }: { draftId: string; durationMin?: number; regenerate?: boolean }) {
  const t = useTranslations("continue");
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "starting" });
  const started = useRef(false);

  const poll = useCallback(
    async (jobId: string) => {
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) continue;
        const job = await res.json();
        if (job.status === "completed" && job.libraryId) {
          router.replace(`/experience/${job.libraryId}?fresh=1`);
          return;
        }
        if (job.status === "failed") {
          setState({ kind: "failed" });
          return;
        }
        setState({ kind: "running", jobId, progress: job.progress, status: job.status });
      }
    },
    [router],
  );

  const start = useCallback(async () => {
    setState({ kind: "starting" });
    const res = await fetch("/api/experiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, durationMin, regenerate }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setState({ kind: "error", code: data.error ?? "generic" });
    if (data.status === "needs_purchase") return setState({ kind: "needs_purchase" });
    if (data.status === "ready") {
      const job = await (await fetch(`/api/jobs/${data.jobId}`)).json();
      if (job.libraryId) return router.replace(`/experience/${job.libraryId}`);
    }
    setState({ kind: "running", jobId: data.jobId, progress: 0, status: "queued" });
    void poll(data.jobId);
  }, [draftId, durationMin, regenerate, poll, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  if (state.kind === "needs_purchase") {
    return (
      <div className="card p-8 text-center">
        <p className="text-ivory">{t("needsPurchase")}</p>
        <a href="#offers" onClick={() => router.push("/plans")} className="btn-primary mt-6">
          {t("seeOptions")}
        </a>
      </div>
    );
  }
  if (state.kind === "failed" || state.kind === "error") {
    return (
      <div className="card p-8 text-center" role="alert">
        <p className="text-ivory">{t("failed")}</p>
        <p className="mt-2 text-sm text-slate">{t("failedSafe")}</p>
        <button className="btn-ghost mt-6" onClick={() => void start()}>
          <RefreshCw className="h-4 w-4" /> {t("retry")}
        </button>
      </div>
    );
  }
  const progress = state.kind === "running" ? state.progress : 0;
  const status = state.kind === "running" ? state.status : "queued";
  return (
    <div className="card flex flex-col items-center p-10 text-center" aria-live="polite">
      <BreathingLight size={160} />
      <p className="mt-8 font-serif text-xl text-ivory">{t(`status_${status}` as "status_queued")}</p>
      <div className="mt-6 h-[3px] w-full max-w-xs rounded-full bg-ivory/8">
        <div className="h-full rounded-full bg-champagne transition-all duration-700" style={{ width: `${Math.max(4, progress)}%` }} />
      </div>
      <p className="mt-6 max-w-sm text-xs leading-relaxed text-slate-2">{t("background")}</p>
    </div>
  );
}
