"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, Lock, Sparkles } from "lucide-react";
import { AMBIENTS, BREATH_PACES, EMOTIONS, GOALS, PACES, SETTINGS, STYLES, TENSION_AREAS, type Option } from "@/content/options";
import type { QuestionId } from "@/content/techniques/registry";
import { Link, useRouter } from "@/i18n/navigation";
import { defaultAddressForm } from "@/lib/names";
import type { ExperienceSettingsInput } from "@/lib/settings";
import { cn } from "@/lib/format";
import { AudioPlayer } from "../player/AudioPlayer";
import { BreathingLight } from "../ui/BreathingLight";
import { useSession } from "../layout/useSession";

export interface GeneratorTechnique {
  id: string;
  name: string;
  durations: number[];
  defaultDuration: number;
  questions: QuestionId[];
  defaultAmbient: string;
}

export interface GeneratorVoice {
  id: string;
  label: string;
  character: string;
}

interface Props {
  technique: GeneratorTechnique;
  voices: GeneratorVoice[];
  /** Defaults to the client-side session lookup. */
  signedIn?: boolean;
  initial?: Partial<ExperienceSettingsInput>;
  productId?: string;
  /** Product pages: fixed language/duration/voice chosen by the author. */
  locked?: { recordingLanguage?: string; durationMin?: number; voicePresetId?: string };
  /** Product pages ask only what the author enabled. */
  questionsOverride?: QuestionId[];
  /** May contain ":draftId". */
  continuePath?: string;
  source?: string;
  onPreview?: (draftId: string) => void;
}

type Phase = "form" | "generating" | "ready";

interface PreviewState {
  draftId: string;
  audioId: string;
  transcript: string;
  isDemo: boolean;
}

const RECORDING = ["en", "pl", "es"] as const;

function lbl(o: Option<unknown>, locale: string) {
  return o.label[(locale as "en") in o.label ? (locale as "en") : "en"];
}

export function Generator({ technique, voices, signedIn: signedInProp, initial, productId, locked, questionsOverride, continuePath, source, onPreview }: Props) {
  const t = useTranslations("generator");
  const tq = useTranslations("questions");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const session = useSession();
  const signedIn = signedInProp ?? !!session?.signedIn;
  const storageKey = `ow:gen:${productId ?? technique.id}`;
  const defaultLang = (RECORDING as readonly string[]).includes(locale) ? locale : "en";

  const [settings, setSettings] = useState<ExperienceSettingsInput>(() => ({
    techniqueId: technique.id as ExperienceSettingsInput["techniqueId"],
    firstName: "",
    recordingLanguage: (locked?.recordingLanguage ?? defaultLang) as "en",
    voicePresetId: locked?.voicePresetId ?? voices[0]?.id,
    durationMin: locked?.durationMin ?? technique.defaultDuration,
    style: "gentle",
    narrationSpeed: "calm",
    pauseLevel: "balanced",
    addressForm: "neutral",
    personalizationLevel: "balanced",
    ...initial,
  }));
  const [addressTouched, setAddressTouched] = useState(!!initial?.addressAs);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const gateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // Keep the card in view when it changes height (form → generating → preview).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const top = root.current?.getBoundingClientRect().top ?? 0;
    if (top < 0 || top > window.innerHeight * 0.6) root.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase, step]);

  // Restore an unfinished form or an already generated preview (e.g. after navigating back).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { settings?: ExperienceSettingsInput; preview?: PreviewState };
      if (saved.settings && !initial?.firstName) setSettings((s) => ({ ...s, ...saved.settings, ...((locked ?? {}) as Partial<ExperienceSettingsInput>) }));
      if (saved.preview) {
        setPreview(saved.preview);
        setPhase("ready");
        onPreview?.(saved.preview.draftId);
      }
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ settings, preview }));
    } catch {
      /* ignore */
    }
  }, [settings, preview, storageKey]);

  useEffect(() => {
    if (phase !== "generating") return;
    const i = setInterval(() => setStatusIdx((x) => (x + 1) % 4), 2200);
    return () => clearInterval(i);
  }, [phase]);

  const questions = questionsOverride ?? technique.questions;
  const set = <K extends keyof ExperienceSettingsInput>(k: K, v: ExperienceSettingsInput[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const toggleIn = (k: "tensionAreas" | "emotions", id: string, max = 6) =>
    setSettings((s) => {
      const list = (s[k] as string[] | undefined) ?? [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : list.length >= max ? list : [...list, id];
      return { ...s, [k]: next };
    });

  const suggestedAddress = useMemo(
    () => (settings.firstName ? defaultAddressForm(settings.firstName, settings.recordingLanguage) : ""),
    [settings.firstName, settings.recordingLanguage],
  );
  const addressAs = addressTouched ? (settings.addressAs ?? "") : suggestedAddress;

  const steps = [t("stepYou"), t("stepExperience"), t("stepVoice")];
  const nameValid = /^[\p{L}][\p{L}\p{M}' .-]{0,39}$/u.test(settings.firstName.trim());

  async function generate() {
    setPhase("generating");
    setError(null);
    setShowGate(false);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { ...settings, addressAs: addressAs || undefined },
          draftId: preview?.draftId,
          productId,
          locale,
          source,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "generic");
      setPreview({ draftId: data.draftId, audioId: data.audioId, transcript: data.transcript, isDemo: data.isDemo });
      setPhase("ready");
      onPreview?.(data.draftId);
    } catch (e) {
      setError((e as Error).message);
      setPhase("form");
    }
  }

  const nextPath = continuePath ? continuePath.replace(":draftId", preview?.draftId ?? "") : `/continue/${preview?.draftId}`;

  function onPreviewPlay() {
    void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: productId ? "product_preview_played" : "preview_played", techniqueId: technique.id, productId }) });
    if (!signedIn && !gateTimer.current) gateTimer.current = setTimeout(() => setShowGate(true), 9000);
  }

  /* ───────────── render: generating ───────────── */
  if (phase === "generating") {
    return (
      <div ref={root} className="card flex min-h-[420px] scroll-mt-24 flex-col items-center justify-center p-8 text-center" aria-live="polite">
        <BreathingLight size={140} />
        <p className="mt-10 font-serif text-2xl text-ivory">{t("generatingTitle", { name: settings.firstName })}</p>
        <p className="mt-3 text-sm text-slate">{t(`generatingStatus${statusIdx}` as "generatingStatus0")}</p>
      </div>
    );
  }

  /* ───────────── render: preview ready ───────────── */
  if (phase === "ready" && preview) {
    return (
      <div ref={root} className="card scroll-mt-24 overflow-hidden p-6 sm:p-10">
        <p className="eyebrow text-center">{t("previewEyebrow")}</p>
        <h3 className="mt-3 text-center text-2xl text-ivory sm:text-3xl">{t("previewTitle", { name: settings.firstName })}</h3>
        <div className="mt-8">
          <AudioPlayer
            src={`/api/audio/${preview.audioId}`}
            title={technique.name}
            subtitle={settings.firstName}
            demo={preview.isDemo}
            autoPlay
            onPlay={onPreviewPlay}
            onEnded={() => !signedIn && setShowGate(true)}
          />
        </div>
        <details className="mx-auto mt-6 max-w-md text-sm text-slate">
          <summary className="cursor-pointer text-center hover:text-champagne">{t("transcript")}</summary>
          <p className="mt-3 rounded-2xl bg-night-3/60 p-4 leading-relaxed text-ivory/80">{preview.transcript}</p>
        </details>

        {signedIn ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button className="btn-primary" onClick={() => router.push(nextPath)}>
              <Sparkles className="h-4 w-4" /> {t("continueFull")}
            </button>
            <button className="text-sm text-slate hover:text-champagne" onClick={() => { setPhase("form"); setStep(0); }}>
              {t("adjust")}
            </button>
          </div>
        ) : showGate ? (
          <div className="mx-auto mt-10 max-w-md animate-fade-up rounded-3xl border border-champagne/25 bg-night/70 p-6 text-center">
            <p className="font-serif text-2xl text-ivory">{t("gateTitle")}</p>
            <p className="mt-2 text-sm text-slate">{t("gateSubtitle")}</p>
            <Link href={`/login?next=${encodeURIComponent(`/${locale}${nextPath}`)}`} className="btn-primary mt-6 w-full" onClick={() => void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "auth_gate_shown", techniqueId: technique.id }) })}>
              <Lock className="h-4 w-4" /> {t("gateCta")}
            </Link>
            <p className="mt-3 text-xs text-slate-2">{productId ? t("gateProductNote") : t("gateFreeNote")}</p>
          </div>
        ) : (
          <div className="mt-8 flex justify-center">
            <button className="text-sm text-slate hover:text-champagne" onClick={() => setShowGate(true)}>
              {t("unlockFull")}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ───────────── render: form ───────────── */
  return (
    <div ref={root} className="card scroll-mt-24 p-6 sm:p-8">
      <div className="mb-7">
        <div className="flex items-center justify-between text-xs text-slate">
          <span>{steps[step]}</span>
          <span>{t("stepOf", { current: step + 1, total: steps.length })}</span>
        </div>
        <div className="mt-3 h-[3px] rounded-full bg-ivory/8">
          <div className="h-full rounded-full bg-champagne transition-all duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-ivory">
          {te.has(error as "generic") ? te(error as "generic") : te("generic")}
        </div>
      )}

      {step === 0 && (
        <div className="space-y-6">
          <div>
            <label className="label" htmlFor="firstName">{t("nameLabel")}</label>
            <input
              id="firstName"
              className="input text-lg"
              autoComplete="given-name"
              maxLength={40}
              value={settings.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder={t("namePlaceholder")}
            />
            <p className="mt-2 text-xs text-slate-2">{t("nameHint")}</p>
          </div>
          {!locked?.recordingLanguage && (
            <div>
              <span className="label">{t("languageLabel")}</span>
              <div className="flex flex-wrap gap-2">
                {RECORDING.map((l) => (
                  <button key={l} type="button" className="chip" data-active={settings.recordingLanguage === l} onClick={() => set("recordingLanguage", l)}>
                    {t(`lang_${l}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {settings.firstName && settings.recordingLanguage !== "en" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="addressAs">{t("addressLabel")}</label>
                <input
                  id="addressAs"
                  className="input"
                  value={addressAs}
                  onChange={(e) => {
                    setAddressTouched(true);
                    set("addressAs", e.target.value);
                  }}
                />
                <p className="mt-2 text-xs text-slate-2">{t("addressHint")}</p>
              </div>
              <div>
                <span className="label">{t("formLabel")}</span>
                <div className="flex flex-wrap gap-2">
                  {(["neutral", "feminine", "masculine"] as const).map((f) => (
                    <button key={f} type="button" className="chip" data-active={settings.addressForm === f} onClick={() => set("addressForm", f)}>
                      {t(`form_${f}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-7">
          {questions.map((q) => (
            <div key={q}>{renderQuestion(q)}</div>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-7">
          {!locked?.voicePresetId && (
            <div>
              <span className="label">{t("voiceLabel")}</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {voices.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => set("voicePresetId", v.id)}
                    className={cn("rounded-2xl border px-4 py-3 text-left transition", settings.voicePresetId === v.id ? "border-champagne bg-champagne/10" : "border-ivory/12 hover:border-champagne/40")}
                  >
                    <span className="block text-sm text-ivory">{v.label}</span>
                    <span className="block text-xs text-slate">{t(`voice_${v.character}` as "voice_soft")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!locked?.durationMin && (
            <div>
              <span className="label">{t("durationLabel")}</span>
              <div className="flex flex-wrap gap-2">
                {technique.durations.map((d) => (
                  <button key={d} type="button" className="chip tabular-nums" data-active={settings.durationMin === d} onClick={() => set("durationMin", d)}>
                    {t("minutes", { count: d })}
                  </button>
                ))}
              </div>
              {!signedIn && !productId && <p className="mt-2 text-xs text-slate-2">{t("durationHint")}</p>}
            </div>
          )}
          <div>
            <span className="label">{t("styleLabel")}</span>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button key={s.id} type="button" className="chip" data-active={settings.style === s.id} onClick={() => set("style", s.id as "gentle")}>
                  {lbl(s, locale)}
                </button>
              ))}
            </div>
          </div>
          {!questions.includes("sleep_sounds") && (
            <div>
              <span className="label">{t("ambientLabel")}</span>
              <div className="flex flex-wrap gap-2">
                {AMBIENTS.map((a) => (
                  <button key={a.id} type="button" className="chip" data-active={(settings.ambient ?? technique.defaultAmbient) === a.id} onClick={() => set("ambient", a.id)}>
                    {a.label[(locale as "en") in a.label ? (locale as "en") : "en"]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-champagne" /> {t("privacyNote")}
          </p>
        </div>
      )}

      <div className="mt-9 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button type="button" className="btn-ghost px-4" onClick={() => setStep(step - 1)} aria-label={t("back")}>
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <span />
        )}
        {step < steps.length - 1 ? (
          <button type="button" className="btn-primary flex-1 sm:flex-none" disabled={step === 0 && !nameValid} onClick={() => setStep(step + 1)}>
            {t("next")} <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" className="btn-primary flex-1 sm:flex-none" disabled={!nameValid} onClick={generate}>
            <Sparkles className="h-4 w-4" /> {t("generate")}
          </button>
        )}
      </div>
    </div>
  );

  /* ───────────── question renderer ───────────── */
  function renderQuestion(id: QuestionId) {
    const label = tq(`${id}.label`);
    const hint = tq.has(`${id}.hint`) ? tq(`${id}.hint`) : null;
    const chipRow = (list: Option<unknown>[], active: (id: string) => boolean, onClick: (id: string) => void) => (
      <div className="flex flex-wrap gap-2">
        {list.map((o) => (
          <button key={o.id} type="button" className="chip" data-active={active(o.id)} onClick={() => onClick(o.id)}>
            {lbl(o, locale)}
          </button>
        ))}
      </div>
    );
    const text = (key: "intention" | "favoritePlace" | "desiredSituation" | "gratitudeFocus" | "event", multiline = false) =>
      multiline ? (
        <textarea className="input min-h-24" maxLength={240} defaultValue={settings[key] ?? ""} onBlur={(e) => set(key, e.target.value)} placeholder={tq(`${id}.placeholder`)} />
      ) : (
        <input className="input" maxLength={140} defaultValue={settings[key] ?? ""} onBlur={(e) => set(key, e.target.value)} placeholder={tq(`${id}.placeholder`)} />
      );
    let control: React.ReactNode = null;
    switch (id) {
      case "goal":
        control = chipRow(GOALS, (x) => settings.goal === x, (x) => set("goal", settings.goal === x ? undefined : x));
        break;
      case "tension_areas":
        control = chipRow(TENSION_AREAS, (x) => !!settings.tensionAreas?.includes(x), (x) => toggleIn("tensionAreas", x));
        break;
      case "pace":
        control = chipRow(PACES, (x) => settings.narrationSpeed === x, (x) => set("narrationSpeed", x as "calm"));
        break;
      case "setting":
        control = chipRow(SETTINGS, (x) => settings.setting === x, (x) => set("setting", settings.setting === x ? undefined : x));
        break;
      case "emotions":
        control = chipRow(EMOTIONS, (x) => !!settings.emotions?.includes(x), (x) => toggleIn("emotions", x, 3));
        break;
      case "sleep_sounds":
        control = (
          <div className="flex flex-wrap gap-2">
            {AMBIENTS.map((a) => (
              <button key={a.id} type="button" className="chip" data-active={(settings.ambient ?? technique.defaultAmbient) === a.id} onClick={() => set("ambient", a.id)}>
                {a.label[(locale as "en") in a.label ? (locale as "en") : "en"]}
              </button>
            ))}
          </div>
        );
        break;
      case "breath_pace":
        control = chipRow(BREATH_PACES, (x) => (settings.breathPace ?? "gentle") === x, (x) => set("breathPace", x as "gentle"));
        break;
      case "intention":
        control = text("intention");
        break;
      case "favorite_place":
        control = text("favoritePlace");
        break;
      case "desired_situation":
        control = text("desiredSituation", true);
        break;
      case "gratitude_focus":
        control = text("gratitudeFocus");
        break;
      case "event":
        control = text("event");
        break;
    }
    return (
      <div>
        <span className="label">
          {label} {!["goal", "tension_areas", "pace", "setting", "sleep_sounds", "breath_pace"].includes(id) && <span className="text-slate-2">· {t("optional")}</span>}
        </span>
        {control}
        {hint && <p className="mt-2 text-xs text-slate-2">{hint}</p>}
      </div>
    );
  }
}
