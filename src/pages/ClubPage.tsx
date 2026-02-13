import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Search, Users, Calendar, ExternalLink, MessageSquare, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClub, useClubLibraries, useClubGameSearch, useClubEvents } from "@/hooks/useClubs";
import { useDebounce } from "@/hooks/useDebounce";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { useAuth } from "@/hooks/useAuth";
import { ClubForumCard } from "@/components/community/ClubForumCard";

import { format } from "date-fns";

export default function ClubPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { data: club, isLoading } = useClub(slug || null);
  const { data: clubLibraries = [] } = useClubLibraries(club?.id || null);
  const { data: clubEvents = [] } = useClubEvents(club?.id || null);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);
  const { data: games = [], isLoading: searchLoading } = useClubGameSearch(
    club?.id || null,
    debouncedQuery
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading club...</div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-display text-cream mb-4">Club Not Found</h1>
          <Link to="/directory">
            <Button variant="secondary">Browse Directory</Button>
          </Link>
        </div>
      </div>
    );
  }

  const upcomingEvents = clubEvents.filter(
    (e) => new Date(e.event_date) >= new Date()
  );

  const isOwner = !!user && club.owner_id === user.id;

  // Group games by title for the "who owns it" view
  const gamesByTitle = new Map<string, typeof games>();
  for (const game of games) {
    const key = game.bgg_id || game.title.toLowerCase();
    if (!gamesByTitle.has(key)) gamesByTitle.set(key, []);
    gamesByTitle.get(key)!.push(game);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark">
      {/* Header */}
      <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-cream/70 hover:text-cream mb-4 text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-4">
            {club.logo_url && (
              <img
                src={club.logo_url}
                alt={club.name}
                className="h-16 w-16 rounded-xl object-cover"
              />
            )}
            <div>
              <h1 className="font-display text-3xl font-bold text-cream">
                {club.name}
              </h1>
              {club.description && (
                <p className="text-cream/70 mt-1">{club.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {clubLibraries.length} {clubLibraries.length === 1 ? "library" : "libraries"}
                </Badge>
                {club.is_public && (
                  <Badge variant="outline" className="text-cream/70">Public</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="catalog" className="w-full">
          <TabsList className="mb-6 bg-wood-dark/60 border border-wood-medium/40">
            <TabsTrigger
              value="catalog"
              className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
            >
              <Search className="h-4 w-4" />
              Game Catalog
            </TabsTrigger>
            <TabsTrigger
              value="libraries"
              className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
            >
              <Users className="h-4 w-4" />
              Member Libraries
            </TabsTrigger>
            <TabsTrigger
              value="events"
              className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
            >
              <Calendar className="h-4 w-4" />
              Events
              {upcomingEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {upcomingEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="forums"
              className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
            >
              <MessageSquare className="h-4 w-4" />
              Forums
            </TabsTrigger>
          </TabsList>

          {/* ── Game Catalog ── */}
          <TabsContent value="catalog">
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/50" />
                <Input
                  placeholder="Search games across all club libraries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-wood-medium/30 border-wood-medium/50 text-cream placeholder:text-cream/40"
                />
              </div>
              <p className="text-cream/50 text-sm mt-2">
                {games.length} games across {clubLibraries.length} libraries
              </p>
            </div>

            {searchLoading ? (
              <div className="text-cream/50 text-center py-12">Searching...</div>
            ) : games.length === 0 ? (
              <div className="text-cream/50 text-center py-12">
                {searchQuery
                  ? "No games found matching your search"
                  : "No games in club libraries yet"}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...gamesByTitle.entries()].map(([key, copies]) => {
                  const first = copies[0];
                  const totalCopies = copies.reduce(
                    (sum, g) => sum + (g.copies_owned || 1),
                    0
                  );
                  return (
                    <Card
                      key={key}
                      className="bg-wood-medium/30 border-wood-medium/50 text-cream overflow-hidden"
                    >
                      <div className="aspect-[3/4] relative overflow-hidden">
                        <img
                          src={first.image_url || "/placeholder.svg"}
                          alt={first.title}
                          className="w-full h-full object-cover"
                        />
                        {totalCopies > 1 && (
                          <Badge className="absolute top-2 right-2 bg-secondary text-secondary-foreground">
                            {totalCopies} copies
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-display font-semibold text-sm truncate">
                          {first.title}
                        </h3>
                        {first.min_players && first.max_players && (
                          <p className="text-xs text-cream/60">
                            {first.min_players}-{first.max_players} players
                          </p>
                        )}
                        <div className="mt-2 space-y-1">
                          {copies.map((copy) => (
                            <a
                              key={copy.id}
                              href={getLibraryUrl(copy.library_slug, "/")}
                              className="flex items-center justify-between text-xs p-1.5 rounded bg-wood-medium/20 hover:bg-wood-medium/40 transition-colors"
                            >
                              <span className="truncate">
                                {copy.owner_name}
                              </span>
                              <span className="text-cream/50 flex-shrink-0 ml-2">
                                {copy.library_name}
                              </span>
                            </a>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Member Libraries ── */}
          <TabsContent value="libraries">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clubLibraries.map((cl: any) => (
                <Card
                  key={cl.id}
                  className="bg-wood-medium/30 border-wood-medium/50 text-cream"
                >
                  <CardHeader>
                    <CardTitle className="text-lg font-display">
                      {cl.library?.name || "Unknown Library"}
                    </CardTitle>
                    <CardDescription className="text-cream/60">
                      Joined {format(new Date(cl.joined_at), "MMM d, yyyy")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {cl.library?.slug && (
                      <a href={getLibraryUrl(cl.library.slug, "/")}>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Visit Library
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── Events ── */}
          <TabsContent value="events">
            {clubEvents.length === 0 ? (
              <div className="text-cream/50 text-center py-12">
                No club events yet
              </div>
            ) : (
              <div className="space-y-4">
                {clubEvents.map((event) => {
                  const isPast = new Date(event.event_date) < new Date();
                  return (
                    <Card
                      key={event.id}
                      className={`bg-wood-medium/30 border-wood-medium/50 text-cream ${
                        isPast ? "opacity-60" : ""
                      }`}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg font-display">
                            {event.title}
                          </CardTitle>
                          <Badge variant={isPast ? "outline" : "secondary"}>
                            {format(new Date(event.event_date), "MMM d, yyyy 'at' h:mm a")}
                          </Badge>
                        </div>
                        {event.event_location && (
                          <CardDescription className="text-cream/60">
                            📍 {event.event_location}
                          </CardDescription>
                        )}
                      </CardHeader>
                      {event.description && (
                        <CardContent>
                          <p className="text-cream/80 text-sm">
                            {event.description}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Forums ── */}
          <TabsContent value="forums">
            <ClubForumCard
              clubId={club.id}
              clubSlug={club.slug}
              isOwner={isOwner}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
