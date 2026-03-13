import { useState } from "react";
import { ChevronRight, ChevronLeft, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Expansion {
  id: string;
  title: string;
  image_url: string | null;
  expansion_type?: string;
}

interface ExpansionPickerProps {
  expansions: Expansion[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  loading?: boolean;
}

export function ExpansionPicker({ expansions, selected, onToggle, loading }: ExpansionPickerProps) {
  const [filter, setFilter] = useState<"all" | "expansion" | "promo">("all");

  if (loading || expansions.length === 0) return null;

  // Filter out promos by default, allow toggle
  const realExpansions = expansions.filter((e) => (e.expansion_type ?? "expansion") === "expansion");
  const promos = expansions.filter((e) => (e.expansion_type ?? "expansion") === "promo");

  const available = (filter === "promo" ? promos : filter === "expansion" ? realExpansions : expansions)
    .filter((e) => !selected.has(e.id));
  const used = expansions.filter((e) => selected.has(e.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Puzzle className="h-4 w-4" />
          Expansions Used
        </label>
        {promos.length > 0 && (
          <div className="flex gap-1">
            {(["all", "expansion", "promo"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border transition-colors capitalize",
                  filter === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                )}
              >
                {f === "all" ? `All (${expansions.length})` : f === "expansion" ? `Expansions (${realExpansions.length})` : `Promos (${promos.length})`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-start">
        {/* Available */}
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Available</p>
          <ScrollArea className="h-32 rounded-md border bg-muted/20 p-1">
            {available.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2 text-center">None</p>
            ) : (
              available.map((exp) => (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => onToggle(exp.id)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50 transition-colors flex items-center gap-1.5 group"
                >
                  <span className="truncate flex-1">{exp.title}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Arrows */}
        <div className="flex flex-col items-center justify-center gap-1 pt-6">
          <ChevronRight className="h-4 w-4 text-primary" />
          <ChevronLeft className="h-4 w-4 text-destructive" />
        </div>

        {/* Used in this game */}
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Used in this game</p>
          <ScrollArea className="h-32 rounded-md border border-primary/30 bg-primary/5 p-1">
            {used.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2 text-center">None selected</p>
            ) : (
              used.map((exp) => (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => onToggle(exp.id)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-destructive/10 transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronLeft className="h-3 w-3 text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  <span className="truncate flex-1">{exp.title}</span>
                </button>
              ))
            )}
          </ScrollArea>
          {promos.length > 0 && (
            <p className="text-[10px] text-muted-foreground italic">Expansions only by default, not promos.</p>
          )}
        </div>
      </div>
    </div>
  );
}
