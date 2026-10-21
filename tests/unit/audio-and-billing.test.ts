import { describe, expect, it } from "vitest";
import { fitPauses } from "@/server/audio/engine";
import { splitRevenue } from "@/server/billing/pricing";
import { fillTemplateText } from "@/server/studio/templates";

describe("audio timeline", () => {
  it("fits flexible pauses to the target using measured speech and keeps fixed pauses exact", () => {
    const segs = [
      { file: "a", durationMs: 10_000, pauseBeforeMs: 2000, pauseAfterMs: 5000, pauseFixed: false },
      { file: "b", durationMs: 3_000, pauseBeforeMs: 0, pauseAfterMs: 5000, pauseFixed: true },
      { file: "c", durationMs: 10_000, pauseBeforeMs: 0, pauseAfterMs: 15_000, pauseFixed: false },
    ];
    const fitted = fitPauses(segs, 60_000);
    const total = fitted.reduce((a, s) => a + s.pauseBeforeMs + s.durationMs + s.pauseAfterMs, 0);
    expect(total).toBe(60_000);
    expect(fitted[1].pauseAfterMs).toBe(5000);
  });
});

describe("revenue split", () => {
  it("splits 30/70 and rounds in the author's favour", () => {
    expect(splitRevenue(7900, 3000)).toEqual({ platform: 2370, author: 5530 });
    expect(splitRevenue(999, 3000)).toEqual({ platform: 299, author: 700 });
  });
});

describe("studio templates", () => {
  it("fills placeholders and drops sentences whose answer is missing", () => {
    const text = "Hello, {{name}}. Imagine you are here: {{place}}. Breathe slowly.";
    expect(fillTemplateText(text, { name: "Anna", place: "a quiet beach" })).toBe("Hello, Anna. Imagine you are here: a quiet beach. Breathe slowly.");
    expect(fillTemplateText(text, { name: "Anna" })).toBe("Hello, Anna. Breathe slowly.");
  });
});
