import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useGameRecommendations } from "@/hooks/useGameRecommendations";
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

export function GameRecommendations({ gameId, gameTitle }: GameRecommendationsProps) {
  const { tenantSlug } = useTenant();
  const { isDemoMode } = useDemoMode();
  const { data: recommendations, isLoading, error } = useGameRecommendations(
    isDemoMode ? undefined : gameId,
    !isDemoMode
  );

  // Don't show in demo mode
  if (isDemoMode) return null;

  // Don't render if no recommendations available
  if (!isLoading && (!recommendations || recommendations.length === 0)) return null;

  const buildGameUrl = (slug: string | null, id: string) => {
    const path = `/game/${slug || id}`;
    return tenantSlug ? getLibraryUrl(tenantSlug, path) : path;
  };

  return (
    <Card className="mt-8">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Games Like {gameTitle}
        </CardTitle>
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
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {recommendations?.map((game) => (
              <Link
                key={game.id}
                to={buildGameUrl(game.slug, game.id)}
                className="group"
              >
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
        )}
      </CardContent>
    </Card>
  );
}
