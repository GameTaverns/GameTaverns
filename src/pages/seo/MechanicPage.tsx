import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { SEO } from "@/components/seo/SEO";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Puzzle, Clock, ChevronRight, ArrowLeft } from "lucide-react";

export default function MechanicPage() {
  const { slug } = useParams<{ slug: string }>();

  // Look up the mechanic by slug (converted from URL slug)
  const { data: mechanic, isLoading: mechanicLoading } = useQuery({
    queryKey: ["mechanic-by-slug", slug],
    queryFn: async () => {
      if (!slug) return null;
      // Convert URL slug back to search: "worker-placement" → "Worker Placement"
      const { data, error } = await supabase
        .from("mechanics")
        .select("id, name")
        .ilike("name", slug.replace(/-/g, " "))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ["catalog-by-mechanic", mechanic?.id],
    queryFn: async () => {
      if (!mechanic?.id) return [];
      const { data, error } = await supabase
        .from("catalog_mechanics")
        .select(`
          game_catalog!inner(
            id, title, slug, image_url, min_players, max_players,
            play_time_minutes, bgg_community_rating, is_expansion
          )
        `)
        .eq("mechanic_id", mechanic.id)
        .limit(48);
      if (error) throw error;
      return data.map((r) => r.game_catalog).filter(Boolean) as Array<{
        id: string; title: string; slug: string | null; image_url: string | null;
        min_players: number | null; max_players: number | null;
        play_time_minutes: number | null; bgg_community_rating: number | null;
        is_expansion: boolean;
      }>;
    },
    enabled: !!mechanic?.id,
  });

  // Also fetch all mechanics for the sidebar nav
  const { data: allMechanics = [] } = useQuery({
    queryKey: ["all-mechanics-nav"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mechanics")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = mechanicLoading || gamesLoading;
  const mechanicName = mechanic?.name || (slug ? slug.replace(/-/g, " ") : "");
  const title = `Best ${mechanicName} Board Games`;
  const description = `Explore the top board games featuring the ${mechanicName} mechanic. Find your next favorite strategy, cooperative, or party game with ${mechanicName} gameplay.`;
  const canonicalUrl = `https://hobby-shelf-spark.lovable.app/catalog/mechanic/${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonicalUrl,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://hobby-shelf-spark.lovable.app" },
        { "@type": "ListItem", position: 2, name: "Catalog", item: "https://hobby-shelf-spark.lovable.app/catalog" },
        { "@type": "ListItem", position: 3, name: "Mechanics", item: "https://hobby-shelf-spark.lovable.app/catalog/mechanics" },
        { "@type": "ListItem", position: 4, name: mechanicName, item: canonicalUrl },
      ],
    },
  };

  if (!mechanicLoading && !mechanic) {
    return (
      <Layout hideSidebar>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <Puzzle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">Mechanic not found</h1>
          <p className="text-muted-foreground mb-6">We couldn't find a mechanic matching "{slug?.replace(/-/g, " ")}".</p>
          <Link to="/catalog/mechanics" className="text-primary hover:underline">Browse all mechanics →</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideSidebar>
      <SEO title={title} description={description} canonical={canonicalUrl} jsonLd={jsonLd} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6 flex-wrap">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/catalog" className="hover:text-foreground">Catalog</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/catalog/mechanics" className="hover:text-foreground">Mechanics</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{mechanicName}</span>
        </nav>

        <div className="flex gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Puzzle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <Badge variant="secondary" className="text-xs mb-1">Game Mechanic</Badge>
                  <h1 className="font-display text-3xl font-bold">{title}</h1>
                </div>
              </div>
              <p className="text-muted-foreground text-lg max-w-2xl">{description}</p>
            </div>

            {/* Results count */}
            {!isLoading && mechanic && (
              <p className="text-sm text-muted-foreground mb-6">
                {games.length}{games.length === 48 ? "+" : ""} games featuring {mechanicName}
              </p>
            )}

            {/* Game grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
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
              <div className="text-center py-16 text-muted-foreground">
                <Puzzle className="h-10 w-10 mx-auto mb-4 opacity-40" />
                <p>No catalog games found for this mechanic yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
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
                          {game.min_players && game.max_players && (
                            <span>{game.min_players}–{game.max_players} players</span>
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
          </div>

          {/* Sidebar — all mechanics */}
          <aside className="w-56 shrink-0 hidden lg:block">
            <div className="sticky top-6">
              <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">
                All Mechanics
              </h3>
              <div className="space-y-0.5 max-h-[70vh] overflow-y-auto pr-2">
                {allMechanics.map((m) => {
                  const mSlug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                  return (
                    <Link
                      key={m.id}
                      to={`/catalog/mechanic/${mSlug}`}
                      className={`block px-2 py-1.5 rounded text-sm transition-colors ${
                        m.id === mechanic?.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {m.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
