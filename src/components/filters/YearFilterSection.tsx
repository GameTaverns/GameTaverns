import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const DECADES = [
  { label: "2020s", start: 2020, end: 2029 },
  { label: "2010s", start: 2010, end: 2019 },
  { label: "2000s", start: 2000, end: 2009 },
  { label: "1990s", start: 1990, end: 1999 },
  { label: "Classic", start: 0, end: 1989 },
];

interface YearFilterSectionProps {
  icon: React.ReactNode;
  filterKey?: string;
  isActive: (filter: string, value: string) => boolean;
  onFilterClick: (filter: string, value: string) => void;
  defaultOpen?: boolean;
}

export function YearFilterSection({
  icon,
  filterKey = "year",
  isActive,
  onFilterClick,
  defaultOpen = false,
}: YearFilterSectionProps) {
  const [expandedDecade, setExpandedDecade] = useState<string | null>(null);

  const handleDecadeClick = (decade: typeof DECADES[number]) => {
    // If clicking the already-expanded decade, collapse it
    if (expandedDecade === decade.label) {
      setExpandedDecade(null);
      // If decade itself was active, clear it
      if (isActive(filterKey, decade.label)) {
        onFilterClick(filterKey, decade.label);
      }
      return;
    }
    // Expand the decade to show individual years
    setExpandedDecade(decade.label);
    // Also set the decade filter
    onFilterClick(filterKey, decade.label);
  };

  const handleYearClick = (year: number) => {
    onFilterClick(filterKey, year.toString());
  };

  // Check if any individual year within a decade is active
  const isDecadeOrChildActive = (decade: typeof DECADES[number]) => {
    if (isActive(filterKey, decade.label)) return true;
    for (let y = decade.start; y <= decade.end; y++) {
      if (isActive(filterKey, y.toString())) return true;
    }
    return false;
  };

  // Generate years for a decade (in reverse order, newest first)
  const getYearsForDecade = (decade: typeof DECADES[number]) => {
    if (decade.label === "Classic") {
      // Show decades for classic: 1980s, 1970s, etc.
      const classicDecades = [];
      for (let d = 1980; d >= 1950; d -= 10) {
        classicDecades.push({ label: `${d}s`, start: d, end: d + 9 });
      }
      classicDecades.push({ label: "Before 1950", start: 0, end: 1949 });
      return classicDecades;
    }
    const years = [];
    for (let y = decade.end; y >= decade.start; y--) {
      years.push(y);
    }
    return years;
  };

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
        <span className="flex items-center gap-2">
          {icon}
          Year
        </span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-0.5">
        <div className="flex flex-col gap-0.5 px-4 py-1">
          {DECADES.map((decade) => {
            const isExpanded = expandedDecade === decade.label;
            const decadeActive = isDecadeOrChildActive(decade);

            return (
              <div key={decade.label}>
                {/* Decade chip */}
                <button
                  onClick={() => handleDecadeClick(decade)}
                  className={cn(
                    "flex items-center gap-1 w-full px-2 py-0.5 rounded-full text-xs font-medium transition-colors border",
                    decadeActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground border-sidebar-primary"
                      : "border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                  {decade.label}
                </button>

                {/* Individual years */}
                {isExpanded && (
                  <div className="flex flex-wrap gap-1 pl-4 py-1">
                    {decade.label === "Classic" ? (
                      // Classic shows sub-decades
                      (getYearsForDecade(decade) as { label: string; start: number; end: number }[]).map((sub) => (
                        <button
                          key={sub.label}
                          onClick={() => onFilterClick(filterKey, sub.label)}
                          className={cn(
                            "px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors border",
                            isActive(filterKey, sub.label)
                              ? "bg-sidebar-primary text-sidebar-primary-foreground border-sidebar-primary"
                              : "border-sidebar-border text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          {sub.label}
                        </button>
                      ))
                    ) : (
                      // Regular decades show individual years
                      (getYearsForDecade(decade) as number[]).map((year) => (
                        <button
                          key={year}
                          onClick={() => handleYearClick(year)}
                          className={cn(
                            "px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors border",
                            isActive(filterKey, year.toString())
                              ? "bg-sidebar-primary text-sidebar-primary-foreground border-sidebar-primary"
                              : "border-sidebar-border text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          {year}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Parse a year filter value into a [min, max] range.
 * Handles: "2020s", "2015", "1980s", "Before 1950", "Classic"
 */
export function parseYearFilterRange(value: string): [number, number] | null {
  // Exact decade labels
  const decadeRanges: Record<string, [number, number]> = {
    "2020s": [2020, 2029],
    "2010s": [2010, 2019],
    "2000s": [2000, 2009],
    "1990s": [1990, 1999],
    "1980s": [1980, 1989],
    "1970s": [1970, 1979],
    "1960s": [1960, 1969],
    "1950s": [1950, 1959],
    "Classic": [0, 1989],
    "Before 1950": [0, 1949],
  };
  if (decadeRanges[value]) return decadeRanges[value];

  // Individual year (e.g. "2015")
  const num = parseInt(value);
  if (!isNaN(num) && num > 0 && num < 3000) return [num, num];

  return null;
}
