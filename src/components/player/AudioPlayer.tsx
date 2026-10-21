"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { formatDuration } from "@/lib/format";

export interface AudioPlayerProps {
  src: string;
  title: string;
  subtitle?: string;
  libraryId?: string;
  initialPositionMs?: number;
  demo?: boolean;
  size?: "lg" | "md";
  autoPlay?: boolean;
  onPlay?: () => void;
  onEnded?: () => void;
  onProgress?: (seconds: number) => void;
}

/** Minimal, calm player. Remembers position for library items and reports listening events. */
export function AudioPlayer({ src, title, subtitle, libraryId, initialPositionMs = 0, demo, size = "lg", autoPlay, onPlay, onEnded, onProgress }: AudioPlayerProps) {
  const t = useTranslations("player");
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const lastSaved = useRef(0);
  const started = useRef(false);

  const report = useCallback(
    (event?: "start" | "complete") => {
      if (!libraryId || !audio.current) return;
      const positionMs = Math.round(audio.current.currentTime * 1000);
      void fetch(`/api/library/${libraryId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionMs, event }),
        keepalive: true,
      }).catch(() => {});
    },
    [libraryId],
  );

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const onLoaded = () => {
      setDuration(el.duration || 0);
      if (initialPositionMs > 0 && initialPositionMs / 1000 < (el.duration || 0) - 5) el.currentTime = initialPositionMs / 1000;
    };
    el.addEventListener("loadedmetadata", onLoaded);
    return () => el.removeEventListener("loadedmetadata", onLoaded);
  }, [initialPositionMs, src]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: "OpenWithin", album: subtitle ?? "" });
    navigator.mediaSession.setActionHandler("play", () => audio.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audio.current?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-15));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(15));
  }, [title, subtitle]);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const skip = (sec: number) => {
    const el = audio.current;
    if (!el) return;
    el.currentTime = Math.min(Math.max(0, el.currentTime + sec), el.duration || el.currentTime + sec);
  };

  const pct = duration ? (current / duration) * 100 : 0;
  const big = size === "lg";

  return (
    <div className="w-full">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        autoPlay={autoPlay}
        onPlay={() => {
          setPlaying(true);
          if (!started.current) {
            started.current = true;
            report("start");
          }
          onPlay?.();
        }}
        onPause={() => {
          setPlaying(false);
          report();
        }}
        onTimeUpdate={(e) => {
          const time = e.currentTarget.currentTime;
          setCurrent(time);
          onProgress?.(time);
          if (time - lastSaved.current > 10) {
            lastSaved.current = time;
            report();
          }
        }}
        onEnded={() => {
          setPlaying(false);
          report("complete");
          onEnded?.();
        }}
      />
      <div className="flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          <span
            aria-hidden
            className={`absolute rounded-full bg-champagne/10 ${big ? "h-40 w-40" : "h-24 w-24"} ${playing ? "animate-breathe" : "opacity-0"} transition-opacity duration-700`}
          />
          <span aria-hidden className={`absolute rounded-full border border-champagne/25 ${big ? "h-32 w-32" : "h-20 w-20"}`} />
          <button
            type="button"
            onClick={toggle}
            className={`relative flex items-center justify-center rounded-full bg-champagne text-night shadow-[0_0_60px_-10px_rgba(216,199,167,0.6)] transition hover:bg-ivory ${big ? "h-20 w-20" : "h-14 w-14"}`}
            aria-label={playing ? t("pause") : t("play")}
          >
            {playing ? <Pause className={big ? "h-7 w-7" : "h-5 w-5"} /> : <Play className={`${big ? "h-7 w-7" : "h-5 w-5"} translate-x-0.5`} />}
          </button>
        </div>
        <div className={`mt-6 w-full ${big ? "max-w-md" : "max-w-sm"}`}>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={(e) => {
              if (audio.current) audio.current.currentTime = Number(e.target.value);
            }}
            aria-label={t("position")}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-ivory/10 accent-champagne"
            style={{ background: `linear-gradient(to right, var(--color-champagne) ${pct}%, rgba(244,241,235,0.1) ${pct}%)` }}
          />
          <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-slate">
            <span>{formatDuration(current * 1000)}</span>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => skip(-15)} className="hover:text-champagne" aria-label={t("back15")}>
                <RotateCcw className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => skip(15)} className="hover:text-champagne" aria-label={t("fwd15")}>
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
            <span>{formatDuration(duration * 1000)}</span>
          </div>
        </div>
        {demo && <p className="mt-4 max-w-sm text-center text-xs text-champagne/80">{t("demoAudio")}</p>}
      </div>
    </div>
  );
}
