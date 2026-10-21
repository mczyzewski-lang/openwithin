import "server-only";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env, features } from "../env";
import { ffmpeg } from "./ffmpeg";

/**
 * Text-to-speech abstraction. ElevenLabs is the production provider; adding another
 * provider means implementing TtsProvider and registering it in getTtsProvider().
 */
export interface TtsRequest {
  text: string;
  providerVoiceId: string;
  language: string;
  tier: "preview" | "full";
  /** percent of natural rate, 70–120 */
  speed: number;
  voiceSettings?: { stability?: number; similarity_boost?: number; style?: number };
  previousText?: string;
  nextText?: string;
}

export interface TtsProvider {
  id: "elevenlabs" | "demo";
  isDemo: boolean;
  modelFor(tier: TtsRequest["tier"]): string;
  synthesize(req: TtsRequest): Promise<Buffer>; // MP3 bytes
  costMicrousd(chars: number, tier: TtsRequest["tier"]): number;
}

export class TtsError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class ElevenLabsProvider implements TtsProvider {
  id = "elevenlabs" as const;
  isDemo = false;

  modelFor(tier: TtsRequest["tier"]) {
    return tier === "preview" ? env.ELEVENLABS_MODEL_PREVIEW : env.ELEVENLABS_MODEL_FULL;
  }

  costMicrousd(chars: number, tier: TtsRequest["tier"]) {
    // Approximate list prices per 1k characters; refine per plan via env if needed.
    const per1k = tier === "preview" ? 0.1 : 0.2;
    return Math.round((chars / 1000) * per1k * 1_000_000);
  }

  async synthesize(req: TtsRequest): Promise<Buffer> {
    const model = this.modelFor(req.tier);
    const body: Record<string, unknown> = {
      text: req.text,
      model_id: model,
      voice_settings: {
        stability: req.voiceSettings?.stability ?? 0.6,
        similarity_boost: req.voiceSettings?.similarity_boost ?? 0.75,
        style: req.voiceSettings?.style ?? 0.15,
        use_speaker_boost: true,
        speed: Math.min(1.2, Math.max(0.7, req.speed / 100)),
      },
    };
    // Language enforcement is only supported by the Flash/Turbo v2.5 family.
    if (/flash|turbo/.test(model)) body.language_code = req.language;
    if (req.previousText) body.previous_text = req.previousText.slice(-300);
    if (req.nextText) body.next_text = req.nextText.slice(0, 300);

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(req.providerVoiceId)}?output_format=mp3_44100_128`;
    let attempt = 0;
    for (;;) {
      attempt++;
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "xi-api-key": env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(req.tier === "preview" ? 20_000 : 90_000),
        });
      } catch (e) {
        if (attempt < 4) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new TtsError(`elevenlabs network error: ${(e as Error).message}`, true);
      }
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      const detail = (await res.text().catch(() => "")).slice(0, 400);
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < 4) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 600 * 2 ** attempt);
        continue;
      }
      throw new TtsError(`elevenlabs ${res.status}: ${detail}`, retryable, res.status);
    }
  }
}

/**
 * DEMO MODE ONLY — offline synthesis with FFmpeg's built-in flite voice (English
 * phonetics, robotic). Lets the whole pipeline run locally without an API key. Audio is
 * flagged `is_demo_audio` and the UI labels it clearly. Never used in production.
 */
class DemoProvider implements TtsProvider {
  id = "demo" as const;
  isDemo = true;
  modelFor() {
    return "flite-slt";
  }
  costMicrousd() {
    return 0;
  }
  async synthesize(req: TtsRequest): Promise<Buffer> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ow-demo-"));
    try {
      const txt = path.join(dir, "t.txt");
      const out = path.join(dir, "o.mp3");
      await writeFile(txt, req.text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L"));
      const tempo = Math.min(1.2, Math.max(0.7, req.speed / 100)) * 1.0;
      await ffmpeg(["-f", "lavfi", "-i", `flite=textfile=${txt}:voice=slt`, "-af", `aresample=44100,atempo=${tempo.toFixed(2)},lowpass=f=6000`, "-ac", "1", "-b:a", "96k", out], 60_000);
      return await readFile(out);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

let provider: TtsProvider | null = null;
export function getTtsProvider(): TtsProvider {
  if (provider) return provider;
  if (features.elevenlabs) provider = new ElevenLabsProvider();
  else if (features.demoTts) provider = new DemoProvider();
  else throw new TtsError("No TTS provider configured. Set ELEVENLABS_API_KEY (or DEMO_MODE=true for local development).", false);
  return provider;
}

export function ttsCacheKey(p: TtsProvider, req: TtsRequest): string {
  return createHash("sha256")
    .update(
      JSON.stringify([p.id, p.modelFor(req.tier), req.providerVoiceId, req.language, req.speed, req.voiceSettings ?? null, req.text, req.previousText ?? "", req.nextText ?? ""]),
    )
    .digest("hex");
}
