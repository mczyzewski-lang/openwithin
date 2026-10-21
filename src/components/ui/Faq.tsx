import { Plus } from "lucide-react";
import type { FaqItem } from "@/content/techniques";

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-ivory/8 border-y border-ivory/8">
      {items.map((f) => (
        <details key={f.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-[17px] text-ivory">
            {f.q}
            <Plus className="h-4 w-4 shrink-0 text-champagne transition group-open:rotate-45" aria-hidden />
          </summary>
          <p className="mt-3 max-w-2xl leading-relaxed text-ivory/70">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
