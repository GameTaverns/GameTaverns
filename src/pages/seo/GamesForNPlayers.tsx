import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { SEO } from "@/components/seo/SEO";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Clock, ChevronRight } from "lucide-react";

const VALID_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];

const playerCountDescriptions: Record<number, string> = {
  1: "perfect for solo play — challenge yourself without needing opponents",
  2: "ideal for two players — couples, friends, or head-to-head rivals",
  3: "great for three players — enough for strategy without long waits",
  4: "the classic group size — balanced, social, and endlessly replayable",
  5: "excellent for five — enough variety for dynamic group dynamics",
  6: "a full table — social games that shine with a crowd",
  7: "big group fun — party games and team-based strategy",
  8: "large group entertainment — the more the merrier",
};

export default function GamesForNPlayers() {
  const { slug } = useParams<{ slug: string }>();
  // slug is like "2-players" — extract the number
  const n = parseInt(slug || "4", 10);

  const isValid = VALID_COUNTS.includes(n);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ["catalog-for-players", n],
    queryFn: async () => {
      if (!isValid) return [];
      const { data, error } = await supabase
        .from("game_catalog")
        .select("id, title, slug, image_url, min_players, max_players, play_time_minutes, bgg_community_rating, is_expansion")
        .lte("min_players", n)
        .gte("max_players", n)
        .eq("is_expansion", false)
        .order("bgg_community_rating", { ascending: false, nullsFirst: false })
        .limit(48);
      if (error) throw error;
      return data;
    },
    enabled: isValid,
  });

  const title = `Best Board Games for ${n} Player${n === 1 ? "" : "s"}`;
  const description = `Discover the top board games ${playerCountDescriptions[n] || `supporting ${n} players`}. Browse our community-curated catalog of ${n}-player games.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `https://gametaverns.com/games-for-${n}-players`,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://gametaverns.com" },
        { "@type": "ListItem", position: 2, name: "Catalog", item: "https://gametaverns.com/catalog" },
        { "@type": "ListItem", position: 3, name: title, item: `https://gametaverns.com/games-for-${n}-players` },
      ],
    },
  };

  if (!isValid) {
    return (
      <Layout hideSidebar>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Page not found</h1>
          <Link to="/catalog" className="text-primary hover:underline">Browse the full catalog →</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideSidebar>
      <SEO
        title={title}
        description={description}
        canonical={`https://hobby-shelf-spark.lovable.app/games-for-${n}-players`}
        jsonLd={jsonLd}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/catalog" className="hover:text-foreground">Catalog</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{title}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold">{title}</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            {description}
          </p>
        </div>

        {/* Player count quick nav */}
        <div className="flex flex-wrap gap-2 mb-8">
          {VALID_COUNTS.map((c) => (
            <Link
              key={c}
              to={`/games-for-${c}-players`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                c === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:border-primary hover:text-foreground"
              }`}
            >
              {c} {c === 1 ? "Player" : "Players"}
            </Link>
          ))}
        </div>

        {/* Results count */}
        {!isLoading && (
          <p className="text-sm text-muted-foreground mb-6">
            Showing {games.length} games{games.length === 48 ? "+" : ""} that support {n} {n === 1 ? "player" : "players"}
          </p>
        )}

        {/* Game grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <CardContent className="p-3">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No games found for {n} players yet.</p>
            <Link to="/catalog" className="text-primary hover:underline text-sm mt-2 inline-block">
              Browse the full catalog →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {games.map((game) => (
              <Link key={game.id} to={`/catalog/${game.slug || game.id}`}>
                <Card className="overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-0.5">
                  <div className="aspect-square bg-muted overflow-hidden">
                    {game.image_url ? (
                      <img
                        src={game.image_url}
                        alt={game.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs text-center p-2">
                        {game.title}
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h2 className="text-xs font-semibold line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">
                      {game.title}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {game.play_time_minutes && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {game.play_time_minutes}m
                        </span>
                      )}
                      {game.bgg_community_rating && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          ★ {game.bgg_community_rating.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Related links */}
        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="font-semibold text-lg mb-4">Explore by player count</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {VALID_COUNTS.filter((c) => c !== n).map((c) => (
              <Link
                key={c}
                to={`/games-for-${c}-players`}
                className="p-3 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-colors group"
              >
                <div className="font-medium text-sm group-hover:text-primary transition-colors">
                  {c} {c === 1 ? "Player" : "Players"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {playerCountDescriptions[c]}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
