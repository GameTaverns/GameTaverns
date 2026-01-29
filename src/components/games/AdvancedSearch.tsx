import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, Filter, SlidersHorizontal, Loader2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

interface AdvancedSearchProps {
  onFiltersChange: (filters: AdvancedFilters) => void;
  totalResults: number;
  className?: string;
}

export function AdvancedSearch({ onFiltersChange, totalResults, className }: AdvancedSearchProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState<AdvancedFilters>(defaultFilters);
  
  const { data: allMechanics = [], isLoading: mechanicsLoading } = useMechanics();
  
  const debouncedSearch = useDebounce(searchValue, 300);

  // Sync search with filters
  useEffect(() => {
    setFilters(prev => ({ ...prev, search: debouncedSearch }));
  }, [debouncedSearch]);

  // Notify parent of filter changes
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

  const handlePlayerChange = useCallback((type: "min" | "max", value: string) => {
    const numValue = value === "any" ? null : parseInt(value, 10);
    setFilters(prev => ({
      ...prev,
      [type === "min" ? "minPlayers" : "maxPlayers"]: numValue,
    }));
  }, []);

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
        return { ...prev, [key]: null };
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

  // Popular mechanics (show first in the list)
  const sortedMechanics = useMemo(() => {
    const popular = ["Deck Building", "Worker Placement", "Dice Rolling", "Hand Management", "Area Control"];
    return [...allMechanics].sort((a, b) => {
      const aPopular = popular.includes(a.name);
      const bPopular = popular.includes(b.name);
      if (aPopular && !bPopular) return -1;
      if (!aPopular && bPopular) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [allMechanics]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Bar + Filter Button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search games..."
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
        
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Advanced Filters</SheetTitle>
              <SheetDescription>
                Narrow down your search with multiple filters
              </SheetDescription>
            </SheetHeader>

            <div className="py-6 space-y-6">
              {/* Player Count */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Player Count</Label>
                <div className="flex gap-2 items-center">
                  <Select
                    value={filters.minPlayers?.toString() || "any"}
                    onValueChange={(v) => handlePlayerChange("min", v)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">to</span>
                  <Select
                    value={filters.maxPlayers?.toString() || "any"}
                    onValueChange={(v) => handlePlayerChange("max", v)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Max" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}+</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Accordion type="multiple" className="w-full" defaultValue={["difficulty", "mechanics"]}>
                {/* Difficulty */}
                <AccordionItem value="difficulty">
                  <AccordionTrigger className="text-sm font-medium">
                    Difficulty
                    {filters.difficulties.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{filters.difficulties.length}</Badge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {DIFFICULTY_OPTIONS.map(diff => (
                        <div key={diff} className="flex items-center space-x-2">
                          <Checkbox
                            id={`diff-${diff}`}
                            checked={filters.difficulties.includes(diff)}
                            onCheckedChange={() => toggleArrayFilter("difficulties", diff)}
                          />
                          <label htmlFor={`diff-${diff}`} className="text-sm cursor-pointer">
                            {diff}
                          </label>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Play Time */}
                <AccordionItem value="playtime">
                  <AccordionTrigger className="text-sm font-medium">
                    Play Time
                    {filters.playTimes.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{filters.playTimes.length}</Badge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {PLAY_TIME_OPTIONS.map(time => (
                        <div key={time} className="flex items-center space-x-2">
                          <Checkbox
                            id={`time-${time}`}
                            checked={filters.playTimes.includes(time)}
                            onCheckedChange={() => toggleArrayFilter("playTimes", time)}
                          />
                          <label htmlFor={`time-${time}`} className="text-sm cursor-pointer">
                            {time}
                          </label>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Game Type */}
                <AccordionItem value="gametype">
                  <AccordionTrigger className="text-sm font-medium">
                    Game Type
                    {filters.gameTypes.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{filters.gameTypes.length}</Badge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {GAME_TYPE_OPTIONS.map(type => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`type-${type}`}
                            checked={filters.gameTypes.includes(type)}
                            onCheckedChange={() => toggleArrayFilter("gameTypes", type)}
                          />
                          <label htmlFor={`type-${type}`} className="text-sm cursor-pointer">
                            {type}
                          </label>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Mechanics */}
                <AccordionItem value="mechanics">
                  <AccordionTrigger className="text-sm font-medium">
                    Mechanics
                    {filters.mechanics.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{filters.mechanics.length}</Badge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    {mechanicsLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading mechanics...
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {sortedMechanics.map(mech => (
                          <div key={mech.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`mech-${mech.id}`}
                              checked={filters.mechanics.includes(mech.name)}
                              onCheckedChange={() => toggleArrayFilter("mechanics", mech.name)}
                            />
                            <label htmlFor={`mech-${mech.id}`} className="text-sm cursor-pointer">
                              {mech.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Quick Filters */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Quick Filters</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="for-sale"
                      checked={filters.forSale}
                      onCheckedChange={() => toggleBooleanFilter("forSale")}
                    />
                    <label htmlFor="for-sale" className="text-sm cursor-pointer">
                      For Sale Only
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="favorites"
                      checked={filters.favorites}
                      onCheckedChange={() => toggleBooleanFilter("favorites")}
                    />
                    <label htmlFor="favorites" className="text-sm cursor-pointer">
                      Favorites Only
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <SheetFooter className="flex-row gap-2">
              <Button variant="outline" onClick={clearAllFilters} className="flex-1">
                Clear All
              </Button>
              <Button onClick={() => setIsOpen(false)} className="flex-1">
                Show {totalResults} Results
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filter Badges */}
      {(filters.search || activeFilterCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.search}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter("search")}
              />
            </Badge>
          )}
          {filters.minPlayers !== null && (
            <Badge variant="secondary" className="gap-1">
              Min {filters.minPlayers} players
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter("minPlayers")}
              />
            </Badge>
          )}
          {filters.maxPlayers !== null && (
            <Badge variant="secondary" className="gap-1">
              Max {filters.maxPlayers}+ players
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter("maxPlayers")}
              />
            </Badge>
          )}
          {filters.difficulties.map(d => (
            <Badge key={d} variant="secondary" className="gap-1">
              {d}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter("difficulties", d)}
              />
            </Badge>
          ))}
          {filters.playTimes.map(t => (
            <Badge key={t} variant="secondary" className="gap-1">
              {t}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter("playTimes", t)}
              />
            </Badge>
          ))}
          {filters.gameTypes.map(t => (
            <Badge key={t} variant="secondary" className="gap-1">
              {t}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter("gameTypes", t)}
              />
            </Badge>
          ))}
          {filters.mechanics.map(m => (
            <Badge key={m} variant="secondary" className="gap-1">
              {m}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter("mechanics", m)}
              />
            </Badge>
          ))}
          {filters.forSale && (
            <Badge variant="secondary" className="gap-1">
              For Sale
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter("forSale")}
              />
            </Badge>
          )}
          {filters.favorites && (
            <Badge variant="secondary" className="gap-1">
              Favorites
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeFilter("favorites")}
              />
            </Badge>
          )}
          {(filters.search || activeFilterCount > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
