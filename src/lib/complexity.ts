/**
 * Maps a numeric weight value to a human-readable complexity label and color.
 * This replaces raw numeric display with branded GT complexity categories.
 */

export type ComplexityLevel = "Light" | "Medium-Light" | "Medium" | "Medium-Heavy" | "Heavy";

export interface ComplexityInfo {
  label: ComplexityLevel;
  /** Tailwind bg class for the colored dot */
  dotClass: string;
  /** Tailwind classes for a colored badge */
  badgeClass: string;
}

export function getComplexity(weight: number | null | undefined): ComplexityInfo | null {
  if (weight == null) return null;

  if (weight <= 1.5) {
    return {
      label: "Light",
      dotClass: "bg-emerald-500",
      badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    };
  }
  if (weight <= 2.5) {
    return {
      label: "Medium-Light",
      dotClass: "bg-lime-500",
      badgeClass: "bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-500/30",
    };
  }
  if (weight <= 3.5) {
    return {
      label: "Medium",
      dotClass: "bg-amber-500",
      badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    };
  }
  if (weight <= 4.25) {
    return {
      label: "Medium-Heavy",
      dotClass: "bg-orange-500",
      badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
    };
  }
  return {
    label: "Heavy",
    dotClass: "bg-red-600",
    badgeClass: "bg-red-600/15 text-red-700 dark:text-red-400 border-red-600/30",
  };
}
