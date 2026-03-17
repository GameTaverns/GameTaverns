/**
 * Rank System
 * 
 * Named ranks calculated from total achievement + quest points.
 * Each rank unlocks cosmetic perks (profile frames, title flairs).
 */

export interface Rank {
  name: string;
  minPoints: number;
  icon: string;
  frameClass: string; // Tailwind classes for profile avatar frame
  titleFlair: string | null; // Display title shown next to name
  color: string; // HSL-based Tailwind class
}

export const RANKS: Rank[] = [
  {
    name: "Novice",
    minPoints: 0,
    icon: "🎲",
    frameClass: "ring-2 ring-muted",
    titleFlair: null,
    color: "text-muted-foreground",
  },
  {
    name: "Apprentice",
    minPoints: 25,
    icon: "📜",
    frameClass: "ring-2 ring-amber-600/60",
    titleFlair: "Apprentice",
    color: "text-amber-600",
  },
  {
    name: "Journeyman",
    minPoints: 75,
    icon: "⚔️",
    frameClass: "ring-3 ring-blue-500/70",
    titleFlair: "Journeyman",
    color: "text-blue-500",
  },
  {
    name: "Tavern Regular",
    minPoints: 150,
    icon: "🍺",
    frameClass: "ring-3 ring-emerald-500/80 shadow-lg shadow-emerald-500/20",
    titleFlair: "Tavern Regular",
    color: "text-emerald-500",
  },
  {
    name: "Game Master",
    minPoints: 300,
    icon: "👑",
    frameClass: "ring-4 ring-yellow-500 shadow-lg shadow-yellow-500/30",
    titleFlair: "Game Master",
    color: "text-yellow-500",
  },
  {
    name: "Tavern Legend",
    minPoints: 600,
    icon: "🏰",
    frameClass: "ring-4 ring-purple-500 shadow-xl shadow-purple-500/40 animate-pulse",
    titleFlair: "Tavern Legend",
    color: "text-purple-500",
  },
];

/**
 * Get the rank for a given point total
 */
export function getRank(points: number): Rank {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.minPoints) {
      rank = r;
    }
  }
  return rank;
}

/**
 * Get the next rank (or null if at max)
 */
export function getNextRank(points: number): Rank | null {
  const currentRank = getRank(points);
  const idx = RANKS.indexOf(currentRank);
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

/**
 * Get progress percentage to next rank
 */
export function getRankProgress(points: number): number {
  const current = getRank(points);
  const next = getNextRank(points);
  if (!next) return 100;
  const range = next.minPoints - current.minPoints;
  const progress = points - current.minPoints;
  return Math.min(100, Math.round((progress / range) * 100));
}
