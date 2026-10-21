/** Sparse, slow drifting particles (pure CSS, deterministic positions — no layout shift). */
export function Particles({ count = 28 }: { count?: number }) {
  const dots = Array.from({ length: count }, (_, i) => {
    const x = (i * 37.7) % 100;
    const delay = -((i * 7.3) % 24);
    const dur = 18 + ((i * 5.1) % 14);
    const s = 1 + ((i * 3) % 3);
    const o = 0.15 + ((i * 11) % 40) / 100;
    return { x, delay, dur, s, o };
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-champagne"
          style={{ left: `${d.x}%`, top: "105%", width: d.s, height: d.s, opacity: d.o, animation: `drift ${d.dur}s linear ${d.delay}s infinite` }}
        />
      ))}
    </div>
  );
}
