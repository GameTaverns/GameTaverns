/**
 * RankUsername — renders a username with color derived from the user's rank tier.
 * Higher ranks get progressively more vibrant / distinctive coloring.
 */
import { getRank } from "@/lib/ranks";
import { cn } from "@/lib/utils";

interface RankUsernameProps {
  name: string;
  points: number;
  className?: string;
  as?: "span" | "h1" | "h2" | "p";
}

/**
 * Returns inline style color for each rank.
 * Uses direct HSL values so they work in both light/dark themes on profiles.
 */
function getRankColor(rankName: string): string | undefined {
  switch (rankName) {
    case "Novice":
      return undefined; // inherit default foreground
    case "Apprentice":
      return "hsl(28, 70%, 50%)"; // warm amber
    case "Journeyman":
      return "hsl(217, 70%, 60%)"; // vivid blue
    case "Tavern Regular":
      return "hsl(160, 60%, 45%)"; // emerald
    case "Game Master":
      return "hsl(45, 90%, 50%)"; // golden
    case "Tavern Legend":
      return "hsl(270, 70%, 65%)"; // regal purple
    default:
      return undefined;
  }
}

export function RankUsername({ name, points, className, as: Tag = "span" }: RankUsernameProps) {
  const rank = getRank(points);
  const color = getRankColor(rank.name);

  return (
    <Tag
      className={cn("transition-colors duration-300", className)}
      style={color ? { color } : undefined}
    >
      {name}
    </Tag>
  );
}
