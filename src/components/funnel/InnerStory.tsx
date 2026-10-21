"use client";

import { useEffect, useState } from "react";
import { BreathingLight } from "../ui/BreathingLight";
import { Particles } from "../ui/Particles";

/**
 * Animated stand-in for the future VSL: eyes close → inner space opens → you hear your
 * name → your experience begins. Set NEXT_PUBLIC_HERO_VIDEO_URL to show a video instead.
 */
export function InnerStory({ captions, videoUrl }: { captions: string[]; videoUrl?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % captions.length), 3800);
    return () => clearInterval(id);
  }, [captions.length]);

  if (videoUrl) {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] border border-ivory/10 bg-night-2 sm:aspect-video">
        <video src={videoUrl} className="h-full w-full object-cover" playsInline controls preload="metadata" />
      </div>
    );
  }
  return (
    <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[2rem] border border-ivory/8 bg-[radial-gradient(ellipse_at_center,#1c2837_0%,#101823_70%)] sm:aspect-[5/4]">
      <Particles count={22} />
      <div className={`transition-all duration-[2000ms] ${i === 0 ? "scale-50 opacity-40" : i === 1 ? "scale-100 opacity-90" : "scale-125 opacity-100"}`}>
        <BreathingLight size={240} />
      </div>
      <div className="absolute inset-x-0 bottom-8 px-6 text-center">
        <div className="mb-4 flex justify-center gap-1.5" aria-hidden>
          {captions.map((_, k) => (
            <span key={k} className={`h-1 rounded-full transition-all duration-700 ${k === i ? "w-6 bg-champagne" : "w-1.5 bg-ivory/20"}`} />
          ))}
        </div>
        <p key={i} className="animate-fade-up font-serif text-xl text-ivory/90 sm:text-2xl" aria-live="polite">
          {captions[i]}
        </p>
      </div>
    </div>
  );
}
