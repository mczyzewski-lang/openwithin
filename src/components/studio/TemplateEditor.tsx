"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, Volume2 } from "lucide-react";
import { AudioPlayer } from "../player/AudioPlayer";

interface Segment {
  phase: string;
  type: string;
  text: string;
  pause_after_ms: number;
  pause_fixed?: boolean;
}
interface Issue {
  code: string;
  detail?: string;
  severity: "error" | "warning";
}

interface Props {
  templateId: string;
  initial: Segment[];
  phases: string[];
  initialIssues: Issue[];
  save: (templateId: string, segments: unknown) => Promise<{ ok: boolean; issues: Issue[] }>;
  requestSample: (templateId: string, name: string) => Promise<{ jobId?: string; error?: string }>;
  lastSample: { audioId: string; isDemo: boolean } | null;
  defaultSampleName: string;
}

/** Scenario editor: edit every spoken segment and every pause before anything is generated. */
export function TemplateEditor({ templateId, initial, phases, initialIssues, save, requestSample, lastSample, defaultSampleName }: Props) {
  const t = useTranslations("studio.editor");
  const tp = useTranslations("phases");
  const [segments, setSegments] = useState<Segment[]>(initial);
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sampleName, setSampleName] = useState(defaultSampleName);
  const [sample, setSample] = useState<{ status: string; audioId?: string; isDemo?: boolean } | null>(lastSample ? { status: "completed", audioId: lastSample.audioId, isDemo: lastSample.isDemo } : null);

  const update = (i: number, patch: Partial<Segment>) => {
    setSegments((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setSegments((s) => {
      const n = [...s];
      const j = i + d;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setDirty(true);
  };
  const totalSec = Math.round(segments.reduce((a, s) => a + s.text.split(/\s+/).length / 2.2 + s.pause_after_ms / 1000, 0));

  async function onSave() {
    setSaving(true);
    const res = await save(templateId, segments);
    setIssues(res.issues);
    setDirty(false);
    setSaving(false);
  }

  async function onSample() {
    if (dirty) await onSave();
    setSample({ status: "queued" });
    const res = await requestSample(templateId, sampleName);
    if (!res.jobId) return setSample({ status: res.error ?? "failed" });
    for (;;) {
      await new Promise((r) => setTimeout(r, 2000));
      const job = await (await fetch(`/api/jobs/${res.jobId}`, { cache: "no-store" })).json();
      if (job.status === "completed") return setSample({ status: "completed", audioId: job.audioId });
      if (job.status === "failed") return setSample({ status: "failed" });
      setSample({ status: job.status });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {segments.map((s, i) => (
          <div key={i} className="card p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select value={s.phase} onChange={(e) => update(i, { phase: e.target.value })} className="rounded-full border border-night/15 bg-white px-2.5 py-1">
                {phases.map((p) => (
                  <option key={p} value={p}>{tp(`${p}.name`)}</option>
                ))}
              </select>
              <span className="rounded-full bg-night/5 px-2.5 py-1 text-night/60">{s.type}</span>
              <div className="ml-auto flex items-center gap-1 text-night/50">
                <button type="button" onClick={() => move(i, -1)} aria-label={t("up")} className="p-1 hover:text-night"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} aria-label={t("down")} className="p-1 hover:text-night"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button
                  type="button"
                  onClick={() => {
                    setSegments((x) => x.filter((_, k) => k !== i));
                    setDirty(true);
                  }}
                  aria-label={t("remove")}
                  className="p-1 hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <textarea value={s.text} onChange={(e) => update(i, { text: e.target.value })} className="input mt-3 min-h-16 text-[15px]" maxLength={420} />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-night/60">
              <label className="inline-flex items-center gap-2">
                {t("pauseAfter")}
                <input
                  type="number"
                  min={0}
                  max={120}
                  step={0.5}
                  value={Math.round(s.pause_after_ms / 100) / 10}
                  onChange={(e) => update(i, { pause_after_ms: Math.round(Number(e.target.value) * 1000) })}
                  className="w-20 rounded-lg border border-night/15 bg-white px-2 py-1"
                />
                s
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!s.pause_fixed} onChange={(e) => update(i, { pause_fixed: e.target.checked })} /> {t("fixedPause")}
              </label>
            </div>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 text-xs text-night/50 hover:text-night"
              onClick={() => {
                setSegments((x) => [...x.slice(0, i + 1), { phase: s.phase, type: "guidance", text: "", pause_after_ms: 3000 }, ...x.slice(i + 1)]);
                setDirty(true);
              }}
            >
              <Plus className="h-3 w-3" /> {t("addAfter")}
            </button>
          </div>
        ))}
      </div>
      <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
        <div className="card p-5">
          <p className="text-sm text-night/60">{t("estimated")}</p>
          <p className="mt-1 font-serif text-2xl">{Math.floor(totalSec / 60)}:{String(totalSec % 60).padStart(2, "0")}</p>
          <p className="mt-1 text-xs text-night/50">{t("segments", { count: segments.length })}</p>
          <button className="btn-primary mt-4 w-full py-2.5 text-sm" onClick={onSave} disabled={saving || !dirty}>
            <Save className="h-4 w-4" /> {saving ? t("saving") : dirty ? t("save") : t("saved")}
          </button>
        </div>
        <div className="card p-5">
          <p className="text-sm">{t("checks")}</p>
          {issues.length === 0 ? (
            <p className="mt-2 text-xs text-night/60">{t("noIssues")}</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {issues.map((i, k) => (
                <li key={k} className={i.severity === "error" ? "text-[#a0453a]" : "text-night/60"}>
                  {t(`issue_${i.code}` as "issue_empty")}
                  {i.detail ? ` — ${i.detail}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-5">
          <p className="text-sm">{t("sampleTitle")}</p>
          <p className="mt-1 text-xs text-night/50">{t("sampleHint")}</p>
          <input value={sampleName} onChange={(e) => setSampleName(e.target.value)} className="input mt-3 py-2.5 text-sm" maxLength={40} />
          <button className="btn-ghost mt-3 w-full py-2.5 text-sm" onClick={onSample} disabled={!!sample && !["completed", "failed", "sample_quota"].includes(sample.status)}>
            <Volume2 className="h-4 w-4" /> {t("sampleCta")}
          </button>
          {sample && sample.status !== "completed" && <p className="mt-3 text-xs text-night/60">{t(`sample_${["failed", "sample_quota"].includes(sample.status) ? sample.status : "working"}` as "sample_working")}</p>}
          {sample?.status === "completed" && sample.audioId && (
            <div className="mt-4 rounded-2xl bg-night p-4">
              <AudioPlayer key={sample.audioId} src={`/api/audio/${sample.audioId}`} title="Sample" size="md" demo={sample.isDemo} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
