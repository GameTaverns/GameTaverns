import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Library, Dice6, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLibraryUrl } from "@/hooks/useTenantUrl";

function useFeaturedLibrary() {
  return useQuery({
    queryKey: ["featured-library"],
    queryFn: async () => {
      // Get the top discoverable library by game count
      const { data: library, error } = await supabase
        .from("library_directory")
        .select("*")
        .eq("is_discoverable", true)
        .order("game_count", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!library?.id) return null;

      // Get some game covers from this library
      const { data: games } = await supabase
        .from("games_public")
        .select("id, title, image_url")
        .eq("library_id", library.id)
        .eq("is_expansion", false)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(12);

      return { library, games: games || [] };
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function FeaturedLibrary() {
  const { data, isLoading } = useFeaturedLibrary();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/30 bg-muted/30 p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { library, games } = data;
  const libraryUrl = getLibraryUrl(library.slug!, "/");

  return (
    <div className="rounded-2xl border border-secondary/20 bg-gradient-to-br from-secondary/5 to-transparent p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          {library.logo_url ? (
            <img
              src={library.logo_url}
              alt={library.name || "Library"}
              className="h-14 w-14 rounded-xl object-cover border border-border/30 shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0">
              <Library className="h-6 w-6 text-secondary" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] text-secondary border-secondary/30 shrink-0">
                Featured Library
              </Badge>
            </div>
            <h3 className="font-display text-xl font-bold text-foreground truncate">{library.name}</h3>
            {library.location_city && (
              <p className="text-sm text-muted-foreground">
                {[library.location_city, library.location_region].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
        <a href={libraryUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-1.5 shrink-0">
            Visit Library
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </a>
      </div>

      {/* Stats */}
      <div className="flex gap-6 mb-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Dice6 className="h-4 w-4 text-secondary" />
          <strong className="text-foreground">{library.game_count}</strong> games
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-secondary" />
          <strong className="text-foreground">{library.member_count}</strong> members
        </span>
        {(library.follower_count ?? 0) > 0 && (
          <span className="text-muted-foreground">
            <strong className="text-foreground">{library.follower_count}</strong> followers
          </span>
        )}
      </div>

      {/* Game grid preview */}
      {games.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
          {games.map((game) => (
            <div
              key={game.id}
              className="aspect-square rounded-lg overflow-hidden border border-border/20 bg-muted/50 group"
              title={game.title || undefined}
            >
              <img
                src={game.image_url!}
                alt={game.title || "Game"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {library.description && (
        <p className="text-sm text-muted-foreground mt-4 line-clamp-2 leading-relaxed">
          {library.description}
        </p>
      )}
    </div>
  );
}
