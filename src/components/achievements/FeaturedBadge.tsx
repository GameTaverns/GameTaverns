import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FeaturedBadgeProps {
  achievement: {
    name: string;
    icon: string | null;
    tier: number;
  } | null;
  size?: "xs" | "sm" | "md";
}

const TIER_COLORS: Record<number, string> = {
  1: 'text-amber-700',
  2: 'text-slate-400',
  3: 'text-yellow-500',
  4: 'text-purple-500',
};

const SIZE_CLASSES = {
  xs: 'w-4 h-4 text-xs',
  sm: 'w-5 h-5 text-sm',
  md: 'w-6 h-6 text-base',
};

export function FeaturedBadge({ achievement, size = "sm" }: FeaturedBadgeProps) {
  if (!achievement) return null;

  const tierColor = TIER_COLORS[achievement.tier] || TIER_COLORS[1];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span 
          className={`inline-flex items-center justify-center ${sizeClass} ${tierColor} cursor-help`}
          aria-label={achievement.name}
        >
          {achievement.icon || '🏆'}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{achievement.name}</p>
      </TooltipContent>
    </Tooltip>
  );
}
