import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ALargeSmall,
  Users,
  Gauge,
  Clock,
  Puzzle,
  Building2,
  PenTool,
  Palette,
  TrendingUp,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DIFFICULTY_OPTIONS, PLAY_TIME_OPTIONS } from "@/types/game";

// Mechanic category groupings — same as library sidebar
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
    "Ladder Climbing", "Matching", "Pattern Building", "Contracts", "Market",
  ],
  "Dice & Luck": [
    "Dice Rolling", "Die Icon Resolution", "Random Production",
    "Push Your Luck", "Betting and Bluffing", "Chit-Pull System",
    "Bag Building", "Pool Building", "Catch the Leader",
    "Re-rolling and Locking", "Stat Check Resolution",
  ],
  "Social": [
    "Negotiation", "Trading", "Voting", "Alliances", "Bribes",
    "Team-Based Game", "Cooperative Game", "Semi-Cooperative Game",
    "Traitor Game", "Hidden Roles", "Role Playing", "Storytelling",
    "Communication Limits", "Acting", "Player Elimination",
  ],
  "Economy": [
    "Resource Management", "Commodity Speculation", "Stock Holding",
    "Income", "Loans", "Auction / Bidding", "Ownership", "Investment",
  ],
  "Combat": [
    "Variable Player Powers", "Simultaneous Action Selection",
    "Take That", "Tug of War", "Siege", "Line of Sight",
    "Command Cards", "Campaign / Battle Card Driven",
    "Scenario / Mission / Campaign Game", "Wargame",
  ],
  "Puzzle": [
    "Pattern Recognition", "Connections", "Enclosure",
    "Drafting", "Open Drafting", "Closed Drafting",
    "Deduction", "Induction", "Memory", "Programmed Movement",
  ],
};

interface CatalogSidebarProps {
  designers: string[];
  artists: string[];
  mechanics: { id: string; name: string }[];
  publishers: { id: string; name: string }[];
}

export function CatalogSidebar({ designers, artists, mechanics, publishers }: CatalogSidebarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = searchParams.get("filter");
  const activeValue = searchParams.get("value");

  const setFilter = (filter: string, value: string) => {
    setSearchParams({ filter, value });
  };

  const clearFilter = () => {
    setSearchParams({});
  };

  const isActive = (filter: string, value: string) =>
    activeFilter === filter && activeValue === value;

  return (
    <div className="w-full">
      {/* Active filter */}
      {activeFilter && activeValue && (
        <div className="px-3 py-2 mb-2">
          <div className="flex items-center justify-between gap-1">
            <Badge variant="secondary" className="text-xs gap-1 truncate max-w-[160px]">
              {activeFilter}: {activeValue}
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={clearFilter}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="h-[calc(100vh-14rem)]">
        {/* Quick Filters */}
        <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Filters
        </div>
        <nav className="space-y-0.5 px-1 mb-2">
          <button
            onClick={() => setFilter("status", "top-rated")}
            className={cn(
              "flex items-center gap-2 w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors hover:bg-accent",
              isActive("status", "top-rated") && "bg-accent font-medium"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Top Rated</span>
          </button>
          <button
            onClick={() => setFilter("status", "expansions")}
            className={cn(
              "flex items-center gap-2 w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors hover:bg-accent",
              isActive("status", "expansions") && "bg-accent font-medium"
            )}
          >
            <Puzzle className="h-4 w-4" />
            <span>Expansions</span>
          </button>
        </nav>

        <div className="border-t border-border/50 mx-3 mb-2" />

        {/* Advanced Filters */}
        <div className="space-y-1">
          {/* A-Z */}
          <FilterSection
            title="A-Z"
            icon={<ALargeSmall className="h-3.5 w-3.5" />}
            defaultOpen={activeFilter === "letter"}
          >
            <div className="grid grid-cols-7 gap-0.5 px-1">
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("").map((letter) => (
                <button
                  key={letter}
                  onClick={() => setFilter("letter", letter)}
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded text-xs font-medium transition-colors hover:bg-accent",
                    isActive("letter", letter) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {letter}
                </button>
              ))}
            </div>
          </FilterSection>

          {/* Players */}
          <ChipFilterSection
            title="Players"
            icon={<Users className="h-3.5 w-3.5" />}
            options={["1 Player", "2 Players", "3-4 Players", "5-6 Players", "7+ Players"]}
            filterKey="players"
            isActive={isActive}
            onFilterClick={setFilter}
            defaultOpen={activeFilter === "players"}
          />

          {/* Difficulty */}
          <ChipFilterSection
            title="Difficulty"
            icon={<Gauge className="h-3.5 w-3.5" />}
            options={DIFFICULTY_OPTIONS as unknown as string[]}
            filterKey="difficulty"
            isActive={isActive}
            onFilterClick={setFilter}
            defaultOpen={activeFilter === "difficulty"}
          />

          {/* Play Time */}
          <ChipFilterSection
            title="Play Time"
            icon={<Clock className="h-3.5 w-3.5" />}
            options={PLAY_TIME_OPTIONS as unknown as string[]}
            filterKey="playtime"
            isActive={isActive}
            onFilterClick={setFilter}
            defaultOpen={activeFilter === "playtime"}
          />

          {/* Mechanics */}
          {mechanics.length > 0 && (
            <FilterSection
              title="Mechanics"
              icon={<Puzzle className="h-3.5 w-3.5" />}
              defaultOpen={activeFilter === "mechanic"}
            >
              <MechanicsFilter
                mechanics={mechanics}
                isActive={isActive}
                onFilterClick={setFilter}
              />
            </FilterSection>
          )}

          {/* Publishers */}
          {publishers.length > 0 && (
            <FilterSection
              title="Publishers"
              icon={<Building2 className="h-3.5 w-3.5" />}
              defaultOpen={activeFilter === "publisher"}
            >
              <div className="max-h-40 overflow-y-auto px-1">
                {publishers.map((pub) => (
                  <button
                    key={pub.id}
                    onClick={() => setFilter("publisher", pub.name)}
                    className={cn(
                      "flex items-center w-full text-left text-xs px-2 py-1 rounded transition-colors hover:bg-accent truncate",
                      isActive("publisher", pub.name) && "bg-accent font-medium"
                    )}
                  >
                    {pub.name}
                  </button>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Designers */}
          {designers.length > 0 && (
            <FilterSection
              title={`Designers (${designers.length})`}
              icon={<PenTool className="h-3.5 w-3.5" />}
              defaultOpen={activeFilter === "designer"}
            >
              <SearchableList
                items={designers}
                filterKey="designer"
                isActive={isActive}
                onFilterClick={setFilter}
                placeholder="Search designers..."
              />
            </FilterSection>
          )}

          {/* Artists */}
          {artists.length > 0 && (
            <FilterSection
              title={`Artists (${artists.length})`}
              icon={<Palette className="h-3.5 w-3.5" />}
              defaultOpen={activeFilter === "artist"}
            >
              <SearchableList
                items={artists}
                filterKey="artist"
                isActive={isActive}
                onFilterClick={setFilter}
                placeholder="Search artists..."
              />
            </FilterSection>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Reusable sub-components ──

function FilterSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-0.5 px-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChipFilterSection({
  title,
  icon,
  options,
  filterKey,
  isActive,
  onFilterClick,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  options: string[];
  filterKey: string;
  isActive: (filter: string, value: string) => boolean;
  onFilterClick: (filter: string, value: string) => void;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-0.5">
        <div className="flex flex-wrap gap-1 px-4 py-1">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => onFilterClick(filterKey, opt)}
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium transition-colors border",
                isActive(filterKey, opt)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SearchableList({
  items,
  filterKey,
  isActive,
  onFilterClick,
  placeholder,
}: {
  items: string[];
  filterKey: string;
  isActive: (filter: string, value: string) => boolean;
  onFilterClick: (filter: string, value: string) => void;
  placeholder: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return items.slice(0, 50);
    const q = search.toLowerCase();
    return items.filter((i) => i.toLowerCase().includes(q)).slice(0, 50);
  }, [items, search]);

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 pl-6 pr-6 text-xs"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {filtered.map((item) => (
          <button
            key={item}
            onClick={() => onFilterClick(filterKey, item)}
            className={cn(
              "flex items-center w-full text-left text-xs px-2 py-1 rounded transition-colors hover:bg-accent truncate",
              isActive(filterKey, item) && "bg-accent font-medium"
            )}
            title={item}
          >
            {item}
          </button>
        ))}
        {items.length > 50 && !search && (
          <p className="text-[10px] text-muted-foreground px-2 py-1">Search to find more...</p>
        )}
      </div>
    </div>
  );
}

function MechanicsFilter({
  mechanics,
  isActive,
  onFilterClick,
}: {
  mechanics: { id: string; name: string }[];
  isActive: (filter: string, value: string) => boolean;
  onFilterClick: (filter: string, value: string) => void;
}) {
  const [search, setSearch] = useState("");

  const mechanicNameSet = useMemo(() => new Set(mechanics.map((m) => m.name)), [mechanics]);

  const groupedCategories = useMemo(() => {
    const result: Record<string, string[]> = {};
    const assigned = new Set<string>();

    for (const [category, mechs] of Object.entries(MECHANIC_CATEGORIES)) {
      const existing = mechs.filter((m) => mechanicNameSet.has(m));
      if (existing.length > 0) {
        result[category] = existing;
        existing.forEach((m) => assigned.add(m));
      }
    }

    const uncategorized = mechanics
      .filter((m) => !assigned.has(m.name))
      .map((m) => m.name)
      .sort();
    if (uncategorized.length > 0) {
      result["Other"] = uncategorized;
    }

    return result;
  }, [mechanics, mechanicNameSet]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groupedCategories;
    const q = search.toLowerCase();
    const result: Record<string, string[]> = {};
    for (const [cat, mechs] of Object.entries(groupedCategories)) {
      const matches = mechs.filter((m) => m.toLowerCase().includes(q));
      if (matches.length > 0) result[cat] = matches;
    }
    return result;
  }, [groupedCategories, search]);

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="Search mechanics..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 pl-6 pr-6 text-xs"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto">
        {Object.entries(filtered).map(([category, mechs]) => (
          <Collapsible key={category} defaultOpen={mechs.some((m) => isActive("mechanic", m))}>
            <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <span>{category}</span>
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground/50">{mechs.length}</span>
                <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-0.5 px-1 pb-1">
                {mechs.map((mech) => (
                  <button
                    key={mech}
                    onClick={() => onFilterClick("mechanic", mech)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] transition-colors border",
                      isActive("mechanic", mech)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground/60 hover:bg-accent"
                    )}
                  >
                    {mech}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
