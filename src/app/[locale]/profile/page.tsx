import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { AMBIENTS, PACES, STYLES } from "@/content/options";
import { CATEGORIES } from "@/content/techniques";
import type { UiLocale } from "@/i18n/locales";
import { defaultAddressForm } from "@/lib/names";
import { deleteAccount, deletePersonalization } from "@/server/account";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/guards";
import { cleanUserText } from "@/server/scenario/context";
import { screenUserInput } from "@/server/scenario/validate";
import { listVoices } from "@/server/voices";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const KINDS = ["motivation", "aspiration", "goal", "person", "memory"] as const;

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { locale } = await params;
  const { saved } = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/profile`);
  const t = await getTranslations("profile");
  const tc = await getTranslations("categories");
  const l = locale as UiLocale;
  const [[p], [basic], items, voices, [marketing]] = await Promise.all([
    db.select().from(schema.personalizationProfiles).where(eq(schema.personalizationProfiles.userId, user.id)),
    db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)),
    db.select().from(schema.personalContextItems).where(eq(schema.personalContextItems.userId, user.id)),
    listVoices(p_lang()),
    db.select().from(schema.consents).where(and(eq(schema.consents.userId, user.id), eq(schema.consents.kind, "marketing"))).orderBy(desc(schema.consents.createdAt)).limit(1),
  ]);
  function p_lang() {
    return ["en", "pl", "es"].includes(locale) ? locale : "en";
  }
  const path = `/${locale}/profile`;

  async function saveProfile(fd: FormData) {
    "use server";
    const s = (k: string) => cleanUserText(String(fd.get(k) ?? ""), 140) ?? null;
    const firstName = cleanUserText(String(fd.get("firstName") ?? ""), 40) ?? null;
    const recordingLanguage = ["en", "pl", "es"].includes(String(fd.get("recordingLanguage"))) ? String(fd.get("recordingLanguage")) : null;
    const values = {
      firstName,
      nameVocative: s("nameVocative") ?? (firstName && recordingLanguage ? defaultAddressForm(firstName, recordingLanguage) : null),
      recordingLanguage,
      voicePresetId: s("voicePresetId"),
      favoritePlace: s("favoritePlace"),
      listeningEnvironment: s("listeningEnvironment"),
      narrationSpeed: s("narrationSpeed") ?? "calm",
      pauseLevel: s("pauseLevel") ?? "balanced",
      defaultDurationMin: Math.min(60, Math.max(5, Number(fd.get("defaultDurationMin")) || 10)),
      ambientTrackId: s("ambientTrackId"),
      personalizationLevel: s("personalizationLevel") ?? "balanced",
      style: s("style"),
      updatedAt: new Date(),
    };
    if (!screenUserInput([values.favoritePlace ?? undefined]).ok) redirect(`${path}?saved=invalid`);
    await db.insert(schema.personalizationProfiles).values({ userId: user.id, ...values }).onConflictDoUpdate({ target: schema.personalizationProfiles.userId, set: values });
    await db.insert(schema.profiles).values({ userId: user.id, firstName }).onConflictDoUpdate({ target: schema.profiles.userId, set: { firstName } });
    revalidatePath(path);
    redirect(`${path}?saved=1`);
  }

  async function addItem(fd: FormData) {
    "use server";
    const kind = String(fd.get("kind"));
    const label = cleanUserText(String(fd.get("label") ?? ""), 80);
    if (!KINDS.includes(kind as never) || !label) return;
    if (!screenUserInput([label]).ok) redirect(`${path}?saved=invalid`);
    const allowed = CATEGORIES.filter((c) => fd.get(`cat_${c}`) === "on");
    const tone = ["positive", "neutral", "mixed"].includes(String(fd.get("tone"))) ? String(fd.get("tone")) : "neutral";
    await db.insert(schema.personalContextItems).values({ userId: user.id, kind, label, tone, allowedCategories: allowed, involvesThirdParty: kind === "person" });
    revalidatePath(path);
  }

  async function removeItem(fd: FormData) {
    "use server";
    await db.delete(schema.personalContextItems).where(and(eq(schema.personalContextItems.id, String(fd.get("id"))), eq(schema.personalContextItems.userId, user.id)));
    revalidatePath(path);
  }

  async function saveReminders(fd: FormData) {
    "use server";
    const enabled = fd.get("enabled") === "on";
    const time = /^\d{2}:\d{2}$/.test(String(fd.get("time"))) ? String(fd.get("time")) : null;
    const tz = cleanUserText(String(fd.get("tz") ?? ""), 60) ?? null;
    await db.update(schema.profiles).set({ remindersEnabled: enabled, reminderTime: time, timezone: tz, updatedAt: new Date() }).where(eq(schema.profiles.userId, user.id));
    await db.insert(schema.consents).values({ userId: user.id, kind: "marketing", version: "2026-10", granted: fd.get("marketing") === "on" });
    revalidatePath(path);
    redirect(`${path}?saved=1`);
  }

  async function wipePersonalization() {
    "use server";
    await deletePersonalization(user.id);
    revalidatePath(path);
  }

  async function wipeAccount() {
    "use server";
    await deleteAccount(user.id);
    redirect(`/${locale}`);
  }

  const sel = (name: string, value: string | null | undefined, options: { id: string; label: string }[]) => (
    <select name={name} defaultValue={value ?? ""} className="input">
      {options.map((o) => (
        <option key={o.id} value={o.id} className="bg-night">
          {o.label}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-12">
        <h1 className="text-4xl text-ivory">{t("title")}</h1>
        <p className="mt-3 text-slate">{t("subtitle")}</p>
        {saved === "1" && <p className="mt-6 rounded-2xl border border-champagne/30 p-3 text-sm text-champagne">{t("saved")}</p>}
        {saved === "invalid" && <p className="mt-6 rounded-2xl border border-danger/30 p-3 text-sm">{t("invalid")}</p>}

        <form action={saveProfile} className="card mt-10 space-y-8 p-6 sm:p-8">
          <div>
            <h2 className="text-xl text-ivory">{t("identity")}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">{t("firstName")}</label>
                <input name="firstName" className="input" defaultValue={p?.firstName ?? basic?.firstName ?? ""} maxLength={40} />
              </div>
              <div>
                <label className="label">{t("addressAs")}</label>
                <input name="nameVocative" className="input" defaultValue={p?.nameVocative ?? ""} maxLength={40} />
              </div>
              <div>
                <label className="label">{t("recordingLanguage")}</label>
                {sel("recordingLanguage", p?.recordingLanguage ?? locale, [
                  { id: "en", label: "English" },
                  { id: "pl", label: "Polski" },
                  { id: "es", label: "Español" },
                ])}
              </div>
              <div>
                <label className="label">{t("voice")}</label>
                {sel("voicePresetId", p?.voicePresetId, voices.map((v) => ({ id: v.id, label: v.label })))}
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl text-ivory">{t("preferences")}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">{t("speed")}</label>
                {sel("narrationSpeed", p?.narrationSpeed, PACES.map((o) => ({ id: o.id, label: o.label[l] })))}
              </div>
              <div>
                <label className="label">{t("pauses")}</label>
                {sel("pauseLevel", p?.pauseLevel, ["short", "balanced", "spacious"].map((id) => ({ id, label: t(`pause_${id}`) })))}
              </div>
              <div>
                <label className="label">{t("duration")}</label>
                <input type="number" name="defaultDurationMin" min={5} max={60} className="input" defaultValue={p?.defaultDurationMin ?? 10} />
              </div>
              <div>
                <label className="label">{t("style")}</label>
                {sel("style", p?.style, STYLES.map((o) => ({ id: o.id, label: o.label[l] })))}
              </div>
              <div>
                <label className="label">{t("ambient")}</label>
                {sel("ambientTrackId", p?.ambientTrackId, AMBIENTS.map((o) => ({ id: o.id, label: o.label[l] })))}
              </div>
              <div>
                <label className="label">{t("level")}</label>
                {sel("personalizationLevel", p?.personalizationLevel, ["light", "balanced", "deep"].map((id) => ({ id, label: t(`level_${id}`) })))}
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-2">{t("levelHint")}</p>
          </div>
          <div>
            <h2 className="text-xl text-ivory">{t("environment")}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">{t("favoritePlace")}</label>
                <input name="favoritePlace" className="input" defaultValue={p?.favoritePlace ?? ""} maxLength={140} />
              </div>
              <div>
                <label className="label">{t("listening")}</label>
                {sel("listeningEnvironment", p?.listeningEnvironment, ["bed", "sofa", "desk", "commute", "outdoors"].map((id) => ({ id, label: t(`env_${id}`) })))}
              </div>
            </div>
          </div>
          <button className="btn-primary">{t("save")}</button>
        </form>

        <section className="card mt-8 p-6 sm:p-8">
          <h2 className="text-xl text-ivory">{t("contextTitle")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate">{t("contextBody")}</p>
          <ul className="mt-6 space-y-3">
            {items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-4 rounded-2xl border border-ivory/8 p-4">
                <div>
                  <p className="text-ivory">{i.label}</p>
                  <p className="mt-1 text-xs text-slate">
                    {t(`kind_${i.kind}`)} · {t(`tone_${i.tone}`)} · {i.allowedCategories.length ? i.allowedCategories.map((c) => tc(c)).join(", ") : t("notUsed")}
                  </p>
                </div>
                <form action={removeItem}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="text-slate hover:text-danger" aria-label={t("remove")}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addItem} className="mt-6 space-y-4 rounded-2xl border border-dashed border-ivory/12 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <select name="kind" className="input">
                {KINDS.map((k) => (
                  <option key={k} value={k} className="bg-night">{t(`kind_${k}`)}</option>
                ))}
              </select>
              <input name="label" className="input" maxLength={80} placeholder={t("labelPlaceholder")} required />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-ivory/80">
              {(["positive", "neutral", "mixed"] as const).map((tone) => (
                <label key={tone} className="inline-flex items-center gap-2">
                  <input type="radio" name="tone" value={tone} defaultChecked={tone === "neutral"} className="accent-[#d8c7a7]" /> {t(`tone_${tone}`)}
                </label>
              ))}
            </div>
            <div>
              <p className="text-xs text-slate">{t("allowIn")}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-ivory/80">
                {CATEGORIES.map((c) => (
                  <label key={c} className="inline-flex items-center gap-2">
                    <input type="checkbox" name={`cat_${c}`} className="accent-[#d8c7a7]" /> {tc(c)}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-2">{t("contextWarning")}</p>
            <button className="btn-ghost px-5 py-2.5 text-sm">{t("add")}</button>
          </form>
        </section>

        <form action={saveReminders} className="card mt-8 space-y-4 p-6 sm:p-8">
          <h2 className="text-xl text-ivory">{t("remindersTitle")}</h2>
          <p className="text-sm text-slate">{t("remindersBody")}</p>
          <label className="flex items-center gap-3 text-ivory/80">
            <input type="checkbox" name="enabled" defaultChecked={basic?.remindersEnabled} className="accent-[#d8c7a7]" /> {t("remindersEnable")}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="time" name="time" className="input" defaultValue={basic?.reminderTime ?? "21:30"} />
            <input name="tz" className="input" defaultValue={basic?.timezone ?? "Europe/Warsaw"} />
          </div>
          <label className="flex items-start gap-3 text-sm text-ivory/80">
            <input type="checkbox" name="marketing" defaultChecked={marketing?.granted} className="mt-1 accent-[#d8c7a7]" /> {t("marketing")}
          </label>
          <button className="btn-ghost px-5 py-2.5 text-sm">{t("save")}</button>
        </form>

        <section className="card mt-8 space-y-4 p-6 sm:p-8">
          <h2 className="text-xl text-ivory">{t("privacyTitle")}</h2>
          <p className="text-sm text-slate">{t("privacyBody")}</p>
          <div className="flex flex-wrap gap-3">
            <a href="/api/account/export" className="btn-ghost px-5 py-2.5 text-sm">{t("export")}</a>
            <form action={wipePersonalization}>
              <ConfirmButton message={t("confirmWipeProfile")} className="btn-ghost px-5 py-2.5 text-sm">{t("wipeProfile")}</ConfirmButton>
            </form>
            <form action={wipeAccount}>
              <ConfirmButton message={t("confirmDelete")} className="btn-ghost border-danger/40 px-5 py-2.5 text-sm text-danger">{t("deleteAccount")}</ConfirmButton>
            </form>
          </div>
          <SignOutButton className="text-sm text-slate hover:text-champagne" />
        </section>
      </main>
      <Footer />
    </>
  );
}
