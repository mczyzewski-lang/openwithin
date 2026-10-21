import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import pl from "@/messages/pl.json";
import { landingAlternates, landingEntries, resolveLandingSlug } from "@/content/techniques";
import { TECHNIQUE_IDS, TECHNIQUES } from "@/content/techniques/registry";

function flatten(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe("translations", () => {
  const keys = new Set(flatten(en));
  it("pl and es have exactly the same keys as en", () => {
    expect(flatten(pl).sort()).toEqual([...keys].sort());
    expect(flatten(es).sort()).toEqual([...keys].sort());
  });
  it("every static key used in the code exists", () => {
    const out = execFileSync("node", ["scripts/i18n-keys.mjs", "src"], { encoding: "utf8" });
    const used = out.split("# dynamic")[0].split("\n").map((s) => s.trim()).filter(Boolean);
    const ignored = new Set(["home.title", "home.description"]); // generateMetadata uses the meta namespace
    const missing = used.filter((k) => !keys.has(k) && !ignored.has(k));
    expect(missing).toEqual([]);
  });
  it("every phase has a localized name and description", () => {
    for (const t of TECHNIQUE_IDS) for (const p of TECHNIQUES[t].phases) for (const m of [en, pl, es]) {
      expect((m.phases as Record<string, { name: string; body: string }>)[p.phase]?.name).toBeTruthy();
    }
  });
});

describe("SEO landing pages", () => {
  const entries = landingEntries();
  it("publishes every landing technique in every MVP language", () => {
    const landing = TECHNIQUE_IDS.filter((id) => TECHNIQUES[id].landing);
    expect(entries).toHaveLength(landing.length * 3);
  });
  it("slugs and aliases are unique per locale", () => {
    for (const locale of ["en", "pl", "es"]) {
      const all = entries.filter((e) => e.locale === locale).flatMap((e) => [e.slug, ...(e.copy.aliases ?? [])]);
      expect(new Set(all).size).toBe(all.length);
    }
  });
  it("uses natural local slugs and complete hreflang alternates", () => {
    expect(resolveLandingSlug("pl", "trening-jacobsona")?.kind).toBe("page");
    expect(resolveLandingSlug("pl", "medytacja-na-sen")?.kind).toBe("page");
    expect(resolveLandingSlug("pl", "wizualizacja-celow")?.kind).toBe("page");
    expect(resolveLandingSlug("es", "relajacion-muscular-progresiva")?.kind).toBe("page");
    expect(resolveLandingSlug("es", "meditacion-para-dormir")?.kind).toBe("page");
    expect(resolveLandingSlug("en", "jacobson-relaxation")).toEqual({ kind: "alias", canonicalSlug: "progressive-muscle-relaxation" });
    for (const e of entries) expect(Object.keys(landingAlternates(e.technique.id)).sort()).toEqual(["en", "es", "pl"]);
  });
  it("has substantive, distinct content (no thin pages)", () => {
    for (const e of entries) {
      const words = [e.copy.h1, e.copy.short, ...(e.copy.intro ?? []), ...(e.copy.forWhom ?? []), ...(e.copy.faq ?? []).flatMap((f) => [f.q, f.a])].join(" ").length;
      // characters rather than words: Polish is inflected and naturally uses fewer, longer words
      expect(words).toBeGreaterThan(850);
      expect(e.copy.faq!.length).toBeGreaterThanOrEqual(3);
    }
    const h1s = entries.map((e) => e.copy.h1);
    expect(new Set(h1s).size).toBe(h1s.length);
  });
});
