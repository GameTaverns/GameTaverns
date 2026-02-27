import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { SEO } from "@/components/seo/SEO";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Library, MapPin, Users, ChevronRight, BookOpen } from "lucide-react";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { Button } from "@/components/ui/button";

function unslugify(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function LibrariesInCity() {
  const { city } = useParams<{ city: string }>();
  const cityName = unslugify(city || "");

  const { data: libraries = [], isLoading } = useQuery({
    queryKey: ["libraries-in-city", city],
    queryFn: async () => {
      if (!city) return [];
      // Search by city slug — match against slugified city name
      const { data, error } = await supabase
        .from("library_directory")
        .select("*")
        .not("location_city", "is", null)
        .order("follower_count", { ascending: false });

      if (error) throw error;

      // Filter client-side by matching slugified city
      return (data || []).filter((lib: any) => {
        const libCitySlug = (lib.location_city || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        return libCitySlug === city;
      });
    },
    enabled: !!city,
  });

  // Also fetch all unique cities for interlinking
  const { data: allCities = [] } = useQuery({
    queryKey: ["all-library-cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_directory")
        .select("location_city, location_region, location_country")
        .not("location_city", "is", null);
      if (error) throw error;

      const cityMap = new Map<string, { city: string; region: string | null; country: string | null; count: number }>();
      (data || []).forEach((lib: any) => {
        const slug = (lib.location_city || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!slug) return;
        const existing = cityMap.get(slug);
        if (existing) existing.count++;
        else cityMap.set(slug, { city: lib.location_city, region: lib.location_region, country: lib.location_country, count: 1 });
      });
      return [...cityMap.entries()].map(([slug, data]) => ({ slug, ...data })).sort((a, b) => b.count - a.count);
    },
  });

  const title = `Board Game Libraries in ${cityName}`;
  const description = `Find board game libraries and lending communities in ${cityName}. Browse collections, borrow games, and join local game nights.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `https://gametaverns.com/libraries/${city}`,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://gametaverns.com" },
        { "@type": "ListItem", position: 2, name: "Directory", item: "https://gametaverns.com/directory" },
        { "@type": "ListItem", position: 3, name: cityName, item: `https://gametaverns.com/libraries/${city}` },
      ],
    },
  };

  return (
    <Layout hideSidebar>
      <SEO
        title={title}
        description={description}
        canonical={`https://gametaverns.com/libraries/${city}`}
        jsonLd={jsonLd}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/directory" className="hover:text-foreground">Directory</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{cityName}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold">{title}</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">{description}</p>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : libraries.length === 0 ? (
          <div className="text-center py-16">
            <Library className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold mb-2">No libraries found in {cityName} yet</h2>
            <p className="text-muted-foreground mb-4">Be the first to create a board game library here!</p>
            <Link to="/signup">
              <Button>Create Your Library</Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {libraries.map((lib: any) => (
              <TenantLink key={lib.id} href={getLibraryUrl(lib.slug, "/")}>
                <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5 h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      {lib.logo_url ? (
                        <img src={lib.logo_url} alt={`${lib.name} logo`} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Library className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h2 className="font-display font-bold text-sm truncate">{lib.name}</h2>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {[lib.location_city, lib.location_region].filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </div>
                    {lib.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{lib.description}</p>
                    )}
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> {lib.game_count} games
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {lib.follower_count} followers
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TenantLink>
            ))}
          </div>
        )}

        {/* Other cities */}
        {allCities.length > 1 && (
          <div className="border-t border-border pt-8">
            <h2 className="font-display font-bold text-lg mb-4">Browse Libraries by City</h2>
            <div className="flex flex-wrap gap-2">
              {allCities.filter((c) => c.slug !== city).slice(0, 20).map((c) => (
                <Link
                  key={c.slug}
                  to={`/libraries/${c.slug}`}
                  className="px-3 py-1.5 rounded-full text-sm border border-border hover:border-primary hover:text-primary transition-colors bg-muted"
                >
                  {c.city} ({c.count})
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
