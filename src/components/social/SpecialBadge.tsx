import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, Palette, Video, BookOpen, Star, Code, BadgeCheck, Store } from "lucide-react";
import type { SpecialBadge as SpecialBadgeType } from "@/hooks/useSpecialBadges";

const ICON_MAP: Record<string, React.ElementType> = {
  Pencil,
  Palette,
  Video,
  BookOpen,
  Star,
  Code,
  BadgeCheck,
  Store,
};

interface SpecialBadgeProps {
  badge: Pick<SpecialBadgeType, "badge_label" | "badge_color" | "badge_icon">;
  size?: "xs" | "sm" | "md";
}

/** A single special display badge (designer, artist, etc.) shown inline next to a username */
export function SpecialBadgePill({ badge, size = "sm" }: SpecialBadgeProps) {
  const Icon = badge.badge_icon ? (ICON_MAP[badge.badge_icon] ?? BadgeCheck) : BadgeCheck;
  const iconSize = size === "xs" ? "h-2.5 w-2.5" : size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const textSize = size === "xs" ? "text-[9px]" : size === "sm" ? "text-[10px]" : "text-xs";
  const px = size === "xs" ? "px-1 py-0.5 gap-0.5" : "px-1.5 py-0.5 gap-1";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center rounded-full font-medium select-none ${px} ${textSize}`}
          style={{
            backgroundColor: `${badge.badge_color}22`,
            color: badge.badge_color,
            border: `1px solid ${badge.badge_color}55`,
          }}
        >
          <Icon className={iconSize} />
          <span>{badge.badge_label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {badge.badge_label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Renders all special badges for a user inline */
interface UserSpecialBadgesProps {
  badges: Pick<SpecialBadgeType, "id" | "badge_label" | "badge_color" | "badge_icon">[];
  size?: "xs" | "sm" | "md";
}

export function UserSpecialBadges({ badges, size = "sm" }: UserSpecialBadgesProps) {
  if (!badges || badges.length === 0) return null;
  return (
    <>
      {badges.map((b) => (
        <SpecialBadgePill key={b.id} badge={b} size={size} />
      ))}
    </>
  );
}
