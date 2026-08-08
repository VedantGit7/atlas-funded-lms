import {
  BookOpen,
  Brain,
  Crown,
  Flame,
  Gem,
  Medal,
  Rocket,
  Shield,
  Star,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const BADGE_ICONS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: "medal", label: "Medal", icon: Medal },
  { key: "star", label: "Star", icon: Star },
  { key: "trophy", label: "Trophy", icon: Trophy },
  { key: "flame", label: "Flame", icon: Flame },
  { key: "zap", label: "Lightning", icon: Zap },
  { key: "target", label: "Target", icon: Target },
  { key: "rocket", label: "Rocket", icon: Rocket },
  { key: "crown", label: "Crown", icon: Crown },
  { key: "gem", label: "Gem", icon: Gem },
  { key: "shield", label: "Shield", icon: Shield },
  { key: "book-open", label: "Book", icon: BookOpen },
  { key: "brain", label: "Brain", icon: Brain },
];

export function badgeIconByKey(key: string | null): LucideIcon {
  return BADGE_ICONS.find((entry) => entry.key === key)?.icon ?? Medal;
}
