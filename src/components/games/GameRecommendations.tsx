import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, BookOpen, ChevronDown } from "lucide-react";
import { useGameRecommendations, GameRecommendation } from "@/hooks/useGameRecommendations";
import { useTenant } from "@/contexts/TenantContext";
import { useDemoMode } from "@/contexts/DemoContext";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { GameImage } from "./GameImage";
import { cn } from "@/lib/utils";

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
  const [showAll, setShowAll] = useState(false);
  if (!games || games.length === 0) return null;

  const visible = showAll ? games : games.slice(0, 5);
  const hasMore = games.length > 5;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {visible.map((game) => (
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
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
        >
          {showAll ? "Show Less" : `Show ${games.length - 5} More`}
        </button>
      )}
    </div>
  );
}

function LoadingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-square rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function CollapsibleSection({
  icon: Icon,
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 hover:bg-accent/5 transition-colors cursor-pointer">
            <div className="flex items-center gap-2.5 text-left">
              <Icon className="h-5 w-5 text-primary shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                {subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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

  const buildLibraryGameUrl = (slug: string | null, id: string) => {
    const path = `/game/${slug || id}`;
    return tenantSlug ? getLibraryUrl(tenantSlug, path) : path;
  };

  const buildCatalogUrl = (slug: string | null, id: string) => {
    return `/catalog/${slug || id}`;
  };

  return (
    <div className="mt-8 space-y-4">
      {/* Row 1: Rediscover Your Shelf — similar games the user already owns */}
      {(isLoading || hasCollectionMatches) && (
        <CollapsibleSection
          icon={BookOpen}
          title="Rediscover Your Shelf"
          subtitle={`Games in your collection similar to ${gameTitle}`}
        >
          {isLoading ? (
            <LoadingSkeleton count={3} />
          ) : (
            <RecommendationGrid games={data!.collection_matches} buildGameUrl={buildGameUrl} />
          )}
        </CollapsibleSection>
      )}

      {/* Row 2: New Discoveries — games NOT in collection */}
      <CollapsibleSection
        icon={Sparkles}
        title="New Discoveries"
        subtitle={`Games you might love based on ${gameTitle}`}
      >
        {isLoading ? (
          <LoadingSkeleton count={5} />
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
      </CollapsibleSection>
    </div>
  );
}
