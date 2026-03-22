import { Link } from "react-router-dom";
import { Sparkles, BookOpen } from "lucide-react";
import { useGameRecommendations, GameRecommendation } from "@/hooks/useGameRecommendations";
import { useTenant } from "@/contexts/TenantContext";
import { useDemoMode } from "@/contexts/DemoContext";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GameImage } from "./GameImage";

interface GameRecommendationsProps {
  gameId: string;
  gameTitle: string;
}

function RecommendationGrid({
  games,
  buildGameUrl,
}: {
  games: GameRecommendation[];
  buildGameUrl: (slug: string | null, id: string) => string;
}) {
  if (!games || games.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {games.map((game) => (
        <Link key={game.id} to={buildGameUrl(game.slug, game.id)} className="group">
          <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2 relative">
            {game.image_url ? (
              <GameImage
                imageUrl={game.image_url}
                alt={game.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                fallback={
                  <div className="h-full w-full flex items-center justify-center">
                    <span className="text-4xl">🎲</span>
                  </div>
                }
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-4xl">🎲</span>
              </div>
            )}
          </div>
          <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
            {game.title}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {game.reason}
          </p>
        </Link>
      ))}
    </div>
  );
}

export function GameRecommendations({ gameId, gameTitle }: GameRecommendationsProps) {
  const { tenantSlug } = useTenant();
  const { isDemoMode } = useDemoMode();
  const { data, isLoading, error } = useGameRecommendations(
    isDemoMode ? undefined : gameId,
    !isDemoMode
  );

  if (isDemoMode) return null;

  const hasDiscoveries = data?.discoveries && data.discoveries.length > 0;
  const hasCollectionMatches = data?.collection_matches && data.collection_matches.length > 0;

  if (!isLoading && !hasDiscoveries && !hasCollectionMatches) return null;

  const buildGameUrl = (slug: string | null, id: string) => {
    const path = `/game/${slug || id}`;
    return tenantSlug ? getLibraryUrl(tenantSlug, path) : path;
  };

  return (
    <div className="mt-8 space-y-6">
      {/* Discoveries - games NOT in collection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Games You Might Like
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Based on mechanics and play style of {gameTitle}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-muted-foreground">
              Unable to load recommendations right now.
            </p>
          ) : hasDiscoveries ? (
            <RecommendationGrid games={data!.discoveries} buildGameUrl={buildGameUrl} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No new discoveries found for this game yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Collection Matches - similar games user already owns */}
      {(isLoading || hasCollectionMatches) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              Similar in Your Collection
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="aspect-square rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            ) : (
              <RecommendationGrid games={data!.collection_matches} buildGameUrl={buildGameUrl} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
