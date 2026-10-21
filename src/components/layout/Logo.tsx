import { Link } from "@/i18n/navigation";

export function Logo({ dark = false, href = "/" }: { dark?: boolean; href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="OpenWithin">
      <span className="relative inline-flex h-6 w-6 items-center justify-center">
        <span className={`absolute inset-0 rounded-full border ${dark ? "border-night/40" : "border-champagne/60"} transition group-hover:scale-110`} />
        <span className={`h-1.5 w-1.5 rounded-full ${dark ? "bg-night" : "bg-ivory"}`} />
      </span>
      <span className={`font-serif text-[19px] tracking-tight ${dark ? "text-night" : "text-ivory"}`}>OpenWithin</span>
    </Link>
  );
}
