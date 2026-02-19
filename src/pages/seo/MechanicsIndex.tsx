import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { SEO } from "@/components/seo/SEO";
import { Layout } from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Puzzle, ChevronRight } from "lucide-react";

export default function MechanicsIndex() {
  const { data: mechanics = [], isLoading } = useQuery({
    queryKey: ["mechanics-with-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mechanics")
        .select(`id, name, catalog_mechanics(count)`)
        .order("name");
      if (error) throw error;
      return data.map((m) => ({
        ...m,
        count: (m.catalog_mechanics as unknown as { count: number }[])?.[0]?.count ?? 0,
      })).sort((a, b) => b.count - a.count);
    },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Board Game Mechanics — GameTaverns",
    description: "Browse board games by mechanic. Find worker placement, deck building, cooperative, and more.",
    url: "https://hobby-shelf-spark.lovable.app/catalog/mechanics",
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://hobby-shelf-spark.lovable.app" },
        { "@type": "ListItem", position: 2, name: "Catalog", item: "https://hobby-shelf-spark.lovable.app/catalog" },
        { "@type": "ListItem", position: 3, name: "Mechanics", item: "https://hobby-shelf-spark.lovable.app/catalog/mechanics" },
      ],
    },
  };

  return (
    <Layout hideSidebar>
      <SEO
        title="Board Game Mechanics"
        description="Browse board games by mechanic — worker placement, deck building, cooperative games, and more. Find your perfect game style on GameTaverns."
        canonical="https://hobby-shelf-spark.lovable.app/catalog/mechanics"
        jsonLd={jsonLd}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/catalog" className="hover:text-foreground">Catalog</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Mechanics</span>
        </nav>

        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Puzzle className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold">Browse by Mechanic</h1>
        </div>
        <p className="text-muted-foreground mb-8 text-lg">
          Find board games by the mechanics that matter to you — from worker placement to deck building and beyond.
        </p>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[...Array(15)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {mechanics.map((m) => {
              const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
              return (
                <Link
                  key={m.id}
                  to={`/catalog/mechanic/${slug}`}
                  className="p-4 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-colors group"
                >
                  <div className="font-medium group-hover:text-primary transition-colors">{m.name}</div>
                  {m.count > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">{m.count} game{m.count !== 1 ? "s" : ""}</div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Player count cross-links */}
        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="font-semibold text-lg mb-4">Browse by player count</h2>
          <div className="flex flex-wrap gap-2">
            {[1,2,3,4,5,6,7,8].map((n) => (
              <Link
                key={n}
                to={`/games-for-${n}-players`}
                className="px-3 py-1.5 rounded-full text-sm border border-border hover:border-primary hover:text-primary transition-colors"
              >
                {n} {n === 1 ? "Player" : "Players"}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
