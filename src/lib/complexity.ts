/**
 * Maps difficulty values to human-readable labels and themed colors.
 * Works with both numeric weight (from catalog) and string difficulty (from library games).
 */

export type ComplexityLevel = "Light" | "Medium Light" | "Medium" | "Medium Heavy" | "Heavy";

export interface ComplexityInfo {
  label: ComplexityLevel;
  /** Tailwind bg class for the colored dot */
  dotClass: string;
  /** Tailwind classes for a colored badge */
  badgeClass: string;
}

const COMPLEXITY_MAP: Record<ComplexityLevel, Omit<ComplexityInfo, "label">> = {
  Light: {
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  "Medium Light": {
    dotClass: "bg-lime-500",
    badgeClass: "bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-500/30",
  },
  Medium: {
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  "Medium Heavy": {
    dotClass: "bg-orange-500",
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  },
  Heavy: {
    dotClass: "bg-red-600",
    badgeClass: "bg-red-600/15 text-red-700 dark:text-red-400 border-red-600/30",
  },
};

/** Get complexity from a numeric weight (catalog data) */
export function getComplexity(weight: number | null | undefined): ComplexityInfo | null {
  if (weight == null) return null;

  let level: ComplexityLevel;
  if (weight <= 1.5) level = "Light";
  else if (weight <= 2.5) level = "Medium Light";
  else if (weight <= 3.5) level = "Medium";
  else if (weight <= 4.25) level = "Medium Heavy";
  else level = "Heavy";

  return { label: level, ...COMPLEXITY_MAP[level] };
}

/**
 * Get complexity from a difficulty string like "2 - Medium Light" or "Medium Light".
 * Strips the leading number prefix and maps to the same color system.
 */
export function getDifficultyDisplay(difficulty: string | null | undefined): ComplexityInfo | null {
  if (!difficulty) return null;

  // Strip "1 - ", "2 - ", etc. prefix
  const cleaned = difficulty.replace(/^\d+\s*-\s*/, "").trim();

  // Normalize to match our keys (handle "Medium-Light" → "Medium Light")
  const normalized = cleaned.replace(/-/g, " ");

  // Find matching level
  for (const key of Object.keys(COMPLEXITY_MAP) as ComplexityLevel[]) {
    if (normalized.toLowerCase() === key.toLowerCase()) {
      return { label: key, ...COMPLEXITY_MAP[key] };
    }
  }

  // Fallback: return with Medium styling if we can't match
  return null;
}
