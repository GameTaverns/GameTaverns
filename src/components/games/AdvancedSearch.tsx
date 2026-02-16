import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, SlidersHorizontal, Loader2, ChevronDown, Users, Clock, Gauge, Tag, Heart, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebounce } from "@/hooks/useDebounce";
import { useMechanics } from "@/hooks/useGames";
import { DIFFICULTY_OPTIONS, GAME_TYPE_OPTIONS, PLAY_TIME_OPTIONS } from "@/types/game";
import { cn } from "@/lib/utils";

export interface AdvancedFilters {
  search: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  difficulties: string[];
  playTimes: string[];
  gameTypes: string[];
  mechanics: string[];
  forSale: boolean;
  comingSoon: boolean;
  favorites: boolean;
}

const defaultFilters: AdvancedFilters = {
  search: "",
  minPlayers: null,
  maxPlayers: null,
  difficulties: [],
  playTimes: [],
  gameTypes: [],
  mechanics: [],
  forSale: false,
  comingSoon: false,
  favorites: false,
};

// Mechanics grouped by category for cleaner browsing
const MECHANIC_CATEGORIES: Record<string, string[]> = {
  "Strategy": [
    "Worker Placement", "Area Control", "Engine Building", "Route Building",
    "Network Building", "Tile Placement", "Area Majority / Influence",
    "Modular Board", "Tech Trees / Tech Tracks", "Rondel",
    "Action Points", "Action Queue", "Action Retrieval",
    "Grid Movement", "Hexagon Grid", "Point to Point Movement",
    "Area Movement", "Map Reduction",
  ],
  "Card & Deck": [
    "Hand Management", "Deck Building", "Deck Construction", "Card Drafting",
    "Card Play Conflict Resolution", "Trick-taking", "Set Collection",
    "Multi-Use Cards", "Tableau Building", "Layering",
    "Ladder Climbing", "Matching", "Pattern Building",
    "Contracts", "Market",
  ],
  "Dice & Luck": [
    "Dice Rolling", "Die Icon Resolution", "Random Production",
    "Push Your Luck", "Betting and Bluffing", "Chit-Pull System",
    "Bag Building", "Pool Building", "Catch the Leader",
    "Re-rolling and Locking", "Stat Check Resolution",
  ],
  "Social & Negotiation": [
    "Negotiation", "Trading", "Voting", "Alliances", "Bribes",
    "Team-Based Game", "Cooperative Game", "Semi-Cooperative Game",
    "Traitor Game", "Hidden Roles", "Role Playing", "Storytelling",
    "Communication Limits", "Acting", "Singing",
    "Player Elimination", "King of the Hill",
  ],
  "Economy & Resources": [
    "Resource Management", "Commodity Speculation", "Stock Holding",
    "Income", "Loans", "Auction / Bidding",
    "Auction: Dutch", "Auction: English", "Auction: Sealed Bid",
    "Auction: Turn Order Until Pass", "Auction: Once Around",
    "Auction: Dexterity", "Auction: Fixed Placement",
    "Ownership", "Investment", "Market",
  ],
  "Combat & Conflict": [
    "Variable Player Powers", "Simultaneous Action Selection",
    "Take That", "Tug of War", "Siege",
    "Line of Sight", "Measurement Movement",
    "Command Cards", "Force Commitment",
    "Campaign / Battle Card Driven", "Scenario / Mission / Campaign Game",
    "Wargame", "Zone of Control",
  ],
  "Timing & Turns": [
    "Turn Order: Progressive", "Turn Order: Stat-Based", "Turn Order: Auction",
    "Turn Order: Claim Action", "Turn Order: Pass Order",
    "Turn Order: Random", "Turn Order: Role Order",
    "Time Track", "Real-Time", "Speed Matching",
    "Interrupts", "Events", "End Game Bonuses",
    "Once-Per-Game Abilities", "Advantage Token",
    "Follow", "I Cut You Choose", "Selection Order Bid",
  ],
  "Puzzle & Pattern": [
    "Pattern Recognition", "Pattern Building", "Connections",
    "Enclosure", "Crayon Rail System", "Grid Coverage",
    "Mancala", "Paper-and-Pencil", "Square Grid",
    "Drafting", "Open Drafting", "Closed Drafting",
    "Variable Set-up", "Variable Phase Order",
    "Deduction", "Induction", "Memory", "Programmed Movement",
    "Predictive Bid", "Relative Movement",
  ],
};

interface AdvancedSearchProps {
  onFiltersChange: (filters: AdvancedFilters) => void;
  totalResults: number;
  className?: string;
}

// Compact popover filter for the quick bar
function QuickFilter({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
}: {
  label: string;
  icon: React.ElementType;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selected.length > 0 ? "secondary" : "outline"}
          size="sm"
          className="gap-1.5 h-8 text-xs"
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          {selected.length > 0 && (
            <Badge variant="default" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px] leading-none">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2 bg-popover border z-50" align="start">
        <div className="space-y-1">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors",
                selected.includes(opt)
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn(
                  "h-3.5 w-3.5 rounded-sm border flex items-center justify-center shrink-0",
                  selected.includes(opt) ? "bg-primary border-primary" : "border-muted-foreground/30"
                )}>
                  {selected.includes(opt) && (
                    <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 12 12">
                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {opt}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Player count quick filter
function PlayerCountFilter({
  min,
  max,
  onChange,
}: {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const hasValue = min !== null || max !== null;
  const label = hasValue
    ? min && max ? `${min}-${max}p` : min ? `${min}+p` : max ? `≤${max}p` : "Players"
    : "Players";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={hasValue ? "secondary" : "outline"}
          size="sm"
          className="gap-1.5 h-8 text-xs"
        >
          <Users className="h-3.5 w-3.5" />
          {label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 bg-popover border z-50" align="start">
        <Label className="text-xs font-medium text-muted-foreground mb-2 block">Player Count</Label>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
            <button
              key={n}
              onClick={() => {
                // Toggle: if already the min, clear it. Otherwise set as exact match.
                if (min === n && max === n) {
                  onChange(null, null);
                } else {
                  onChange(n, n);
                }
              }}
              className={cn(
                "h-8 w-8 rounded-md text-sm font-medium transition-colors",
                min === n && max === n
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-foreground"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={() => onChange(min, null)}
            className={cn(
              "flex-1 h-7 rounded-md text-xs font-medium transition-colors",
              min !== null && max === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-foreground"
            )}
          >
            {min || "?"}+ players
          </button>
          <button
            onClick={() => onChange(null, null)}
            className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Clear
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AdvancedSearch({ onFiltersChange, totalResults, className }: AdvancedSearchProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [mechanicSearch, setMechanicSearch] = useState("");
  const [filters, setFilters] = useState<AdvancedFilters>(defaultFilters);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { data: allMechanics = [], isLoading: mechanicsLoading } = useMechanics();
  
  const debouncedSearch = useDebounce(searchValue, 300);

  // Global "/" keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setFilters(prev => ({ ...prev, search: debouncedSearch }));
  }, [debouncedSearch]);

  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.difficulties.length) count++;
    if (filters.playTimes.length) count++;
    if (filters.gameTypes.length) count++;
    if (filters.mechanics.length) count++;
    if (filters.minPlayers !== null || filters.maxPlayers !== null) count++;
    if (filters.forSale) count++;
    if (filters.comingSoon) count++;
    if (filters.favorites) count++;
    return count;
  }, [filters]);

  const toggleArrayFilter = useCallback((
    key: "difficulties" | "playTimes" | "gameTypes" | "mechanics",
    value: string
  ) => {
    setFilters(prev => {
      const current = prev[key];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  }, []);

  const toggleBooleanFilter = useCallback((key: "forSale" | "comingSoon" | "favorites") => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchValue("");
    setFilters(defaultFilters);
  }, []);

  const removeFilter = useCallback((key: keyof AdvancedFilters, value?: string) => {
    setFilters(prev => {
      if (Array.isArray(prev[key]) && value) {
        return { ...prev, [key]: (prev[key] as string[]).filter(v => v !== value) };
      }
      if (key === "minPlayers" || key === "maxPlayers") {
        return { ...prev, minPlayers: null, maxPlayers: null };
      }
      if (typeof prev[key] === "boolean") {
        return { ...prev, [key]: false };
      }
      if (key === "search") {
        setSearchValue("");
        return { ...prev, search: "" };
      }
      return prev;
    });
  }, []);

  // Build mechanic name set for fast lookup
  const mechanicNameSet = useMemo(() => new Set(allMechanics.map(m => m.name)), [allMechanics]);

  // Filter mechanics categories to only include mechanics that exist in the library
  const filteredCategories = useMemo(() => {
    const result: Record<string, string[]> = {};
    const assigned = new Set<string>();

    for (const [category, mechanics] of Object.entries(MECHANIC_CATEGORIES)) {
      const existing = mechanics.filter(m => mechanicNameSet.has(m));
      if (existing.length > 0) {
        result[category] = existing;
        existing.forEach(m => assigned.add(m));
      }
    }

    // "Other" bucket for mechanics not in any predefined category
    const uncategorized = allMechanics
      .filter(m => !assigned.has(m.name))
      .map(m => m.name)
      .sort();
    if (uncategorized.length > 0) {
      result["Other"] = uncategorized;
    }

    return result;
  }, [allMechanics, mechanicNameSet]);

  // Filtered mechanics for search within the sheet
  const searchFilteredCategories = useMemo(() => {
    if (!mechanicSearch.trim()) return filteredCategories;
    const q = mechanicSearch.toLowerCase();
    const result: Record<string, string[]> = {};
    for (const [cat, mechs] of Object.entries(filteredCategories)) {
      const matches = mechs.filter(m => m.toLowerCase().includes(q));
      if (matches.length > 0) result[cat] = matches;
    }
    return result;
  }, [filteredCategories, mechanicSearch]);

  const advancedFilterCount = filters.gameTypes.length + filters.mechanics.length +
    (filters.forSale ? 1 : 0) + (filters.favorites ? 1 : 0);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Row 1: Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          placeholder="Search games... (press / to focus)"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => setSearchValue("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Row 2: Quick Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <PlayerCountFilter
          min={filters.minPlayers}
          max={filters.maxPlayers}
          onChange={(min, max) => setFilters(prev => ({ ...prev, minPlayers: min, maxPlayers: max }))}
        />

        <QuickFilter
          label="Difficulty"
          icon={Gauge}
          options={DIFFICULTY_OPTIONS}
          selected={filters.difficulties}
          onToggle={(v) => toggleArrayFilter("difficulties", v)}
        />

        <QuickFilter
          label="Play Time"
          icon={Clock}
          options={PLAY_TIME_OPTIONS}
          selected={filters.playTimes}
          onToggle={(v) => toggleArrayFilter("playTimes", v)}
        />

        {/* Quick toggle buttons */}
        <Button
          variant={filters.favorites ? "secondary" : "outline"}
          size="sm"
          className="gap-1.5 h-8 text-xs"
          onClick={() => toggleBooleanFilter("favorites")}
        >
          <Heart className={cn("h-3.5 w-3.5", filters.favorites && "fill-current")} />
          Favorites
        </Button>

        <Button
          variant={filters.forSale ? "secondary" : "outline"}
          size="sm"
          className="gap-1.5 h-8 text-xs"
          onClick={() => toggleBooleanFilter("forSale")}
        >
          <DollarSign className="h-3.5 w-3.5" />
          For Sale
        </Button>

        {/* More Filters (opens sheet with game type, mechanics, etc.) */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              More Filters
              {advancedFilterCount > 0 && (
                <Badge variant="default" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px] leading-none">
                  {advancedFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md flex flex-col">
            <SheetHeader>
              <SheetTitle>More Filters</SheetTitle>
              <SheetDescription>
                Filter by game type, mechanics, and more
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="py-4 space-y-5">
                {/* Game Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    Game Type
                    {filters.gameTypes.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{filters.gameTypes.length}</Badge>
                    )}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {GAME_TYPE_OPTIONS.map(type => (
                      <button
                        key={type}
                        onClick={() => toggleArrayFilter("gameTypes", type)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
                          filters.gameTypes.includes(type)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border text-foreground"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mechanics - Grouped by Category */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                    Mechanics
                    {filters.mechanics.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{filters.mechanics.length}</Badge>
                    )}
                  </Label>

                  {/* Mechanic search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search mechanics..."
                      value={mechanicSearch}
                      onChange={(e) => setMechanicSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                    {mechanicSearch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                        onClick={() => setMechanicSearch("")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {mechanicsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading mechanics...
                    </div>
                  ) : (
                    <Accordion type="multiple" className="w-full" defaultValue={
                      // Auto-expand categories that have selected mechanics
                      Object.entries(searchFilteredCategories)
                        .filter(([, mechs]) => mechs.some(m => filters.mechanics.includes(m)))
                        .map(([cat]) => cat)
                    }>
                      {Object.entries(searchFilteredCategories).map(([category, mechanics]) => {
                        const selectedInCategory = mechanics.filter(m => filters.mechanics.includes(m)).length;
                        return (
                          <AccordionItem key={category} value={category} className="border-b-0">
                            <AccordionTrigger className="text-xs font-medium py-2 hover:no-underline">
                              <span className="flex items-center gap-2">
                                {category}
                                <span className="text-muted-foreground font-normal">({mechanics.length})</span>
                                {selectedInCategory > 0 && (
                                  <Badge variant="default" className="h-4 min-w-[16px] px-1 text-[10px] leading-none">
                                    {selectedInCategory}
                                  </Badge>
                                )}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="pb-2">
                              <div className="flex flex-wrap gap-1">
                                {mechanics.map(mech => (
                                  <button
                                    key={mech}
                                    onClick={() => toggleArrayFilter("mechanics", mech)}
                                    className={cn(
                                      "px-2 py-0.5 rounded-full text-xs transition-colors border",
                                      filters.mechanics.includes(mech)
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background hover:bg-muted border-border text-muted-foreground"
                                    )}
                                  >
                                    {mech}
                                  </button>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </div>
              </div>
            </ScrollArea>

            <SheetFooter className="flex-row gap-2 pt-4 border-t">
              <Button variant="outline" onClick={clearAllFilters} className="flex-1">
                Clear All
              </Button>
              <Button onClick={() => setIsOpen(false)} className="flex-1">
                Show {totalResults} Results
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Clear all (only when filters active) */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={clearAllFilters}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Active Filter Badges (compact, only show when there are many) */}
      {(filters.search || activeFilterCount > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {filters.search && (
            <Badge variant="secondary" className="gap-1 text-xs h-6">
              "{filters.search}"
              <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeFilter("search")} />
            </Badge>
          )}
          {(filters.minPlayers !== null || filters.maxPlayers !== null) && (
            <Badge variant="secondary" className="gap-1 text-xs h-6">
              {filters.minPlayers === filters.maxPlayers
                ? `${filters.minPlayers}p`
                : filters.minPlayers && filters.maxPlayers
                  ? `${filters.minPlayers}-${filters.maxPlayers}p`
                  : filters.minPlayers
                    ? `${filters.minPlayers}+p`
                    : `≤${filters.maxPlayers}p`
              }
              <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeFilter("minPlayers")} />
            </Badge>
          )}
          {filters.difficulties.map(d => (
            <Badge key={d} variant="secondary" className="gap-1 text-xs h-6">
              {d}
              <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeFilter("difficulties", d)} />
            </Badge>
          ))}
          {filters.playTimes.map(t => (
            <Badge key={t} variant="secondary" className="gap-1 text-xs h-6">
              {t}
              <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeFilter("playTimes", t)} />
            </Badge>
          ))}
          {filters.gameTypes.map(t => (
            <Badge key={t} variant="secondary" className="gap-1 text-xs h-6">
              {t}
              <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeFilter("gameTypes", t)} />
            </Badge>
          ))}
          {filters.mechanics.map(m => (
            <Badge key={m} variant="secondary" className="gap-1 text-xs h-6">
              {m}
              <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeFilter("mechanics", m)} />
            </Badge>
          ))}
          {filters.forSale && (
            <Badge variant="secondary" className="gap-1 text-xs h-6">
              For Sale
              <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeFilter("forSale")} />
            </Badge>
          )}
          {filters.favorites && (
            <Badge variant="secondary" className="gap-1 text-xs h-6">
              Favorites
              <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeFilter("favorites")} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
