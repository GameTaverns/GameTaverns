import { GameCard } from "./GameCard";
import { Search, SlidersHorizontal } from "lucide-react";
import type { GameWithRelations } from "@/types/game";

interface GameGridProps {
  games: GameWithRelations[];
  hasActiveFilters?: boolean;
}

export function GameGrid({ games, hasActiveFilters }: GameGridProps) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
          {hasActiveFilters ? (
            <SlidersHorizontal className="h-8 w-8 text-muted-foreground/60" />
          ) : (
            <Search className="h-8 w-8 text-muted-foreground/60" />
          )}
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          {hasActiveFilters ? "No matching games" : "No games yet"}
        </h3>
        <p className="text-muted-foreground text-sm max-w-md">
          {hasActiveFilters
            ? "Try clearing some filters or searching with different terms to find what you're looking for."
            : "This library doesn't have any games yet. Check back soon — games may be added at any time!"}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4" style={{ gridAutoRows: '1fr' }}>
      {games.map((game, index) => (
        <div key={game.id} className="h-full">
          <GameCard game={game} priority={index < 5} />
        </div>
      ))}
    </div>
  );
}
