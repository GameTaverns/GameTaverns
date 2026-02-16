import { useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Hash, Users, Weight, Clock, PenTool, Palette, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CatalogSidebarProps {
  designers: string[];
  artists: string[];
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

const PLAYER_OPTIONS = ["1", "2", "3", "4", "5-6", "7+"];

const DIFFICULTY_OPTIONS = [
  "1 - Light",
  "2 - Medium Light",
  "3 - Medium",
  "4 - Medium Heavy",
  "5 - Heavy",
];

const PLAYTIME_OPTIONS = [
  "0-15 Minutes",
  "15-30 Minutes",
  "30-45 Minutes",
  "45-60 Minutes",
  "60+ Minutes",
  "2+ Hours",
  "3+ Hours",
];

export function CatalogSidebar({ designers, artists }: CatalogSidebarProps) {
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
    <div className="w-full space-y-1">
      {/* Active filter */}
      {activeFilter && activeValue && (
        <div className="px-3 py-2 mb-2">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs gap-1 truncate max-w-[160px]">
              {activeFilter}: {activeValue}
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={clearFilter}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="space-y-1 pr-2">
          {/* Letters */}
          <FilterSection icon={Hash} label="By Letter" defaultOpen>
            <div className="grid grid-cols-7 gap-1">
              {LETTERS.map((letter) => (
                <Button
                  key={letter}
                  variant={isActive("letter", letter) ? "default" : "ghost"}
                  size="sm"
                  className="h-7 w-7 p-0 text-xs font-mono"
                  onClick={() => setFilter("letter", letter)}
                >
                  {letter}
                </Button>
              ))}
            </div>
          </FilterSection>

          {/* Players */}
          <FilterSection icon={Users} label="Players">
            <div className="flex flex-wrap gap-1">
              {PLAYER_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  variant={isActive("players", opt) ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setFilter("players", opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          </FilterSection>

          {/* Difficulty */}
          <FilterSection icon={Weight} label="Difficulty">
            <div className="space-y-0.5">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  variant={isActive("difficulty", opt) ? "default" : "ghost"}
                  size="sm"
                  className={cn("w-full justify-start text-xs h-7", isActive("difficulty", opt) && "font-medium")}
                  onClick={() => setFilter("difficulty", opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          </FilterSection>

          {/* Playtime */}
          <FilterSection icon={Clock} label="Play Time">
            <div className="space-y-0.5">
              {PLAYTIME_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  variant={isActive("playtime", opt) ? "default" : "ghost"}
                  size="sm"
                  className={cn("w-full justify-start text-xs h-7", isActive("playtime", opt) && "font-medium")}
                  onClick={() => setFilter("playtime", opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          </FilterSection>

          {/* Designers */}
          {designers.length > 0 && (
            <FilterSection icon={PenTool} label={`Designers (${designers.length})`}>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {designers.slice(0, 50).map((d) => (
                  <Button
                    key={d}
                    variant={isActive("designer", d) ? "default" : "ghost"}
                    size="sm"
                    className={cn("w-full justify-start text-xs h-7 truncate", isActive("designer", d) && "font-medium")}
                    onClick={() => setFilter("designer", d)}
                    title={d}
                  >
                    {d}
                  </Button>
                ))}
                {designers.length > 50 && (
                  <p className="text-[10px] text-muted-foreground px-2 py-1">Use search to find more...</p>
                )}
              </div>
            </FilterSection>
          )}

          {/* Artists */}
          {artists.length > 0 && (
            <FilterSection icon={Palette} label={`Artists (${artists.length})`}>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {artists.slice(0, 50).map((a) => (
                  <Button
                    key={a}
                    variant={isActive("artist", a) ? "default" : "ghost"}
                    size="sm"
                    className={cn("w-full justify-start text-xs h-7 truncate", isActive("artist", a) && "font-medium")}
                    onClick={() => setFilter("artist", a)}
                    title={a}
                  >
                    {a}
                  </Button>
                ))}
                {artists.length > 50 && (
                  <p className="text-[10px] text-muted-foreground px-2 py-1">Use search to find more...</p>
                )}
              </div>
            </FilterSection>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function FilterSection({
  icon: Icon,
  label,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between h-8 px-3 text-xs font-medium">
          <span className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5" />
            {label}
          </span>
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 py-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
