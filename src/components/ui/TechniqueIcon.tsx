import {
  Activity, BedDouble, Circle, CloudMoon, Compass, Eye, Feather, Flag, Heart, Home, Moon, MoonStar, ScanLine, Sparkle, Sun, Sunrise, Sunset, Target, Waves, Wind, Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = { Activity, BedDouble, Circle, CloudMoon, Compass, Eye, Feather, Flag, Heart, Home, Moon, MoonStar, ScanLine, Sparkle, Sun, Sunrise, Sunset, Target, Waves, Wind, Zap };

export function TechniqueIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Circle;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}
