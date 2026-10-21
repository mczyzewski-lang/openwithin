/** A slowly expanding point of light — the visual motif of OpenWithin. */
export function BreathingLight({ size = 220, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }} aria-hidden>
      <span className="absolute inset-0 animate-breathe rounded-full bg-[radial-gradient(circle,rgba(216,199,167,0.35)_0%,rgba(216,199,167,0.08)_45%,transparent_70%)]" />
      <span className="absolute inset-[22%] animate-breathe rounded-full bg-[radial-gradient(circle,rgba(244,241,235,0.55)_0%,rgba(216,199,167,0.15)_50%,transparent_72%)] [animation-delay:-1.2s]" />
      <span className="relative h-2.5 w-2.5 rounded-full bg-ivory shadow-[0_0_24px_6px_rgba(244,241,235,0.55)]" />
    </div>
  );
}
