"use client";

import { useState } from "react";
import { Generator, type GeneratorTechnique, type GeneratorVoice } from "./Generator";

export function QuickStart({ techniques, voices }: { techniques: GeneratorTechnique[]; voices: GeneratorVoice[] }) {
  const [active, setActive] = useState(techniques[0]?.id);
  const technique = techniques.find((t) => t.id === active) ?? techniques[0];
  return (
    <div>
      <div className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
        {techniques.map((t) => (
          <button key={t.id} type="button" className="chip shrink-0" data-active={t.id === active} onClick={() => setActive(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      <Generator key={technique.id} technique={technique} voices={voices} source="home" />
    </div>
  );
}
