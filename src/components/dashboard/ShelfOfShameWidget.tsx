import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookX, Clock, ArrowRight, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { differenceInDays } from "date-fns";

interface ShelfOfShameGame {
  id: string;
  title: string;
  image_url: string | null;
  slug: string | null;
  created_at: string;
  library_id: string;
}

export function ShelfOfShameWidget({ libraryId }: { libraryId: string | undefined }) {
  const { data: unplayedGames = [], isLoading } = useQuery({
    queryKey: ["shelf-of-shame", libraryId],
    queryFn: async (): Promise<ShelfOfShameGame[]> => {
      if (!libraryId) return [];

      // Get games marked as unplayed, ordered by oldest first (longest shame)
      const { data, error } = await supabase
        .from("games")
        .select("id, title, image_url, slug, created_at, library_id")
        .eq("library_id", libraryId)
        .eq("is_unplayed", true)
        .eq("is_expansion", false)
        .order("created_at", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!libraryId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading || unplayedGames.length === 0) return null;

  const getShameLevel = (daysOwned: number) => {
    if (daysOwned > 365) return { label: "Legendary Shame", color: "text-red-400", icon: "🔥" };
    if (daysOwned > 180) return { label: "Epic Shame", color: "text-orange-400", icon: "😬" };
    if (daysOwned > 90) return { label: "Growing Shame", color: "text-yellow-400", icon: "😅" };
    return { label: "New Shame", color: "text-cream/60", icon: "📦" };
  };

  return (
    <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookX className="h-5 w-5 text-secondary" />
            Shelf of Shame
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {unplayedGames.length} unplayed
          </Badge>
        </div>
        <CardDescription className="text-cream/60">
          Games waiting to hit the table
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {unplayedGames.map((game) => {
          const daysOwned = differenceInDays(new Date(), new Date(game.created_at));
          const shame = getShameLevel(daysOwned);

          return (
            <div
              key={game.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-wood-medium/20 hover:bg-wood-medium/40 transition-colors"
            >
              {game.image_url ? (
                <img
                  src={game.image_url}
                  alt={game.title}
                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-wood-medium/40 flex items-center justify-center flex-shrink-0">
                  <BookX className="h-5 w-5 text-cream/40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{game.title}</p>
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3 w-3 text-cream/50" />
                  <span className={shame.color}>
                    {shame.icon} {daysOwned} days — {shame.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {unplayedGames.length >= 5 && (
          <p className="text-xs text-cream/50 text-center pt-1">
            Showing top 5 longest shames
          </p>
        )}
      </CardContent>
    </Card>
  );
}
