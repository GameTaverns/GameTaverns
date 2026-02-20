import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/seo/SEO";
import { Layout } from "@/components/layout/Layout";
import { useLibraryDirectory } from "@/hooks/useLibraryDirectory";
import { useAuth } from "@/hooks/useAuth";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Users,
  Gamepad2,
  Heart,
  HeartOff,
  TrendingUp,
  Clock,
  BookOpen,
  ExternalLink,
  ArrowLeft,
  MapPin,
  Filter,
  X,
  Globe,
  Map,
  Building2,
} from "lucide-react";
import type { LibraryDirectoryEntry } from "@/hooks/useLibraryDirectory";

export default function Directory() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterCity, setFilterCity] = useState<string>("all");

  const {
    libraries,
    isLoading,
    isFollowing,
    toggleFollow,
    searchLibraries,
    popularLibraries,
    newestLibraries,
    lendingLibraries,
  } = useLibraryDirectory();

  const regions = useMemo(() => {
    const set = new Set<string>();
    libraries.forEach((l) => { if (l.location_region) set.add(l.location_region); });
    return Array.from(set).sort();
  }, [libraries]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    libraries.forEach((l) => { if (l.location_country) set.add(l.location_country); });
    return Array.from(set).sort();
  }, [libraries]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    libraries.forEach((l) => {
      if (l.location_city) {
        // Only include cities from matching country/region if those filters are active
        if (filterCountry !== "all" && l.location_country !== filterCountry) return;
        if (filterRegion !== "all" && l.location_region !== filterRegion) return;
        set.add(l.location_city);
      }
    });
    return Array.from(set).sort();
  }, [libraries, filterCountry, filterRegion]);

  const applyLocationFilter = (list: LibraryDirectoryEntry[]) =>
    list.filter((l) => {
      if (filterCountry !== "all" && l.location_country !== filterCountry) return false;
      if (filterRegion !== "all" && l.location_region !== filterRegion) return false;
      if (filterCity !== "all" && l.location_city !== filterCity) return false;
      return true;
    });

  const hasLocationFilters = filterRegion !== "all" || filterCountry !== "all" || filterCity !== "all";
  const activeFilterCount = [filterCountry, filterRegion, filterCity].filter(v => v !== "all").length;

  const clearFilters = () => {
    setFilterRegion("all");
    setFilterCountry("all");
    setFilterCity("all");
  };

  const baseFiltered = searchQuery ? searchLibraries(searchQuery) : libraries;
  const filteredLibraries = applyLocationFilter(baseFiltered);

  const LibraryCard = ({ library }: { library: LibraryDirectoryEntry }) => {
    const following = isFollowing(library.id);
    const locationParts = [library.location_city, library.location_region, library.location_country].filter(Boolean);
    const locationStr = locationParts.join(", ");

    return (
      <Card className="group hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={library.logo_url || undefined} alt={library.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-display">
                  {library.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="text-lg group-hover:text-primary transition-colors truncate">
                  {library.name}
                </CardTitle>
                <CardDescription className="text-sm">
                  @{library.slug}
                </CardDescription>
              </div>
            </div>
            {user && (
              <Button
                variant={following ? "outline" : "default"}
                size="sm"
                onClick={() => toggleFollow(library.id)}
                className="gap-1 shrink-0"
              >
                {following ? (
                  <><HeartOff className="h-4 w-4" />Unfollow</>
                ) : (
                  <><Heart className="h-4 w-4" />Follow</>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {library.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {library.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Gamepad2 className="h-4 w-4" />
              {library.game_count} games
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {library.follower_count} followers
            </span>
          </div>

          {locationStr && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 text-primary/70" />
              {locationStr}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {library.allow_lending && (
              <Badge variant="secondary" className="text-xs">
                <BookOpen className="h-3 w-3 mr-1" />
                Lending Available
              </Badge>
            )}
          </div>

          <TenantLink
            href={getLibraryUrl(library.slug, "/")}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Visit Library
            <ExternalLink className="h-3 w-3" />
          </TenantLink>
        </CardContent>
      </Card>
    );
  };

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const FilterSidebar = () => (
    <aside className="w-64 shrink-0 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="default" className="text-xs h-5 px-1.5">
              {activeFilterCount}
            </Badge>
          )}
        </h2>
        {hasLocationFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <Separator />

      {/* Country filter */}
      {countries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            Country
          </h3>
          <div className="space-y-1">
            <button
              onClick={() => { setFilterCountry("all"); setFilterCity("all"); }}
              className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
                filterCountry === "all"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              All Countries
            </button>
            {countries.map((c) => (
              <button
                key={c}
                onClick={() => { setFilterCountry(c); setFilterCity("all"); }}
                className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
                  filterCountry === c
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* State / Region filter */}
      {regions.length > 0 && (
        <>
          {countries.length > 0 && <Separator />}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Map className="h-3.5 w-3.5 text-muted-foreground" />
              State / Region
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => { setFilterRegion("all"); setFilterCity("all"); }}
                className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
                  filterRegion === "all"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                All Regions
              </button>
              {regions.map((r) => (
                <button
                  key={r}
                  onClick={() => { setFilterRegion(r); setFilterCity("all"); }}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
                    filterRegion === r
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* City filter */}
      {cities.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              City
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setFilterCity("all")}
                className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
                  filterCity === "all"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                All Cities
              </button>
              {cities.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCity(c)}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
                    filterCity === c
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {countries.length === 0 && regions.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground italic">
          No location data available yet.
        </p>
      )}
    </aside>
  );

  return (
    <Layout hideSidebar>
      <SEO
        title="Library Directory"
        description="Discover board game libraries near you. Browse collections, follow your favorite libraries, and find games to borrow from the GameTaverns community."
        canonical="https://hobby-shelf-spark.lovable.app/directory"
      />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          {user && (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          )}
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Library Directory
          </h1>
          <p className="text-muted-foreground">
            Discover game libraries from the community, follow your favorites, and borrow games
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search libraries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sidebar + Content layout */}
        <div className="flex gap-8">
          <FilterSidebar />

          <div className="flex-1 min-w-0">
            <Tabs defaultValue="all" className="space-y-6">
              <TabsList>
                <TabsTrigger value="all">All Libraries</TabsTrigger>
                <TabsTrigger value="popular" className="gap-1">
                  <TrendingUp className="h-4 w-4" />Popular
                </TabsTrigger>
                <TabsTrigger value="newest" className="gap-1">
                  <Clock className="h-4 w-4" />Newest
                </TabsTrigger>
                <TabsTrigger value="lending" className="gap-1">
                  <BookOpen className="h-4 w-4" />With Lending
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                {isLoading ? (
                  <LoadingSkeleton />
                ) : filteredLibraries.length === 0 ? (
                  <div className="text-center py-12">
                    <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No libraries found</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || hasLocationFilters ? "Try adjusting your search or filters" : "No public libraries available yet"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredLibraries.map((library) => (
                      <LibraryCard key={library.id} library={library} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="popular">
                {isLoading ? <LoadingSkeleton /> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {applyLocationFilter(popularLibraries).map((library) => (
                      <LibraryCard key={library.id} library={library} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="newest">
                {isLoading ? <LoadingSkeleton /> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {applyLocationFilter(newestLibraries).map((library) => (
                      <LibraryCard key={library.id} library={library} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="lending">
                {isLoading ? <LoadingSkeleton /> : applyLocationFilter(lendingLibraries).length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No lending libraries</h3>
                    <p className="text-muted-foreground">No libraries have enabled game lending yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {applyLocationFilter(lendingLibraries).map((library) => (
                      <LibraryCard key={library.id} library={library} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
}
