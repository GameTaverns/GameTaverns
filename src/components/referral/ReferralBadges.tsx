import { REFERRAL_TIERS, FOUNDING_MEMBER_BADGE, type ReferralBadge } from "@/hooks/useReferral";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ReferralBadgesProps {
  badges: ReferralBadge | null | undefined;
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
  className?: string;
}

export function ReferralBadges({ badges, size = "md", showLabels = false, className }: ReferralBadgesProps) {
  if (!badges) return null;

  const earnedTiers = REFERRAL_TIERS.filter((t) => badges[t.key]);
  const hasFoundingMember = badges.is_founding_member;

  if (earnedTiers.length === 0 && !hasFoundingMember) return null;

  const sizeClasses = {
    sm: "text-base px-2 py-0.5 text-xs gap-1",
    md: "text-lg px-2.5 py-1 text-xs gap-1.5",
    lg: "text-2xl px-3 py-1.5 text-sm gap-2",
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {/* Founding Member (always first, most prestigious) */}
      {hasFoundingMember && (
        <Tooltip>
          <TooltipTrigger>
            <span
              className={cn(
                "inline-flex items-center rounded-full border font-medium",
                FOUNDING_MEMBER_BADGE.color,
                sizeClasses[size]
              )}
            >
              <span>{FOUNDING_MEMBER_BADGE.emoji}</span>
              {showLabels && <span>{FOUNDING_MEMBER_BADGE.label}</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-semibold">{FOUNDING_MEMBER_BADGE.label}</p>
            <p className="text-xs text-muted-foreground">{FOUNDING_MEMBER_BADGE.description}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Referral tiers — show highest earned most prominently */}
      {[...earnedTiers].reverse().map((tier) => (
        <Tooltip key={tier.key}>
          <TooltipTrigger>
            <span
              className={cn(
                "inline-flex items-center rounded-full border font-medium",
                tier.color,
                sizeClasses[size]
              )}
            >
              <span>{tier.emoji}</span>
              {showLabels && <span>{tier.label}</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-semibold">{tier.label}</p>
            <p className="text-xs text-muted-foreground">{tier.description}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
