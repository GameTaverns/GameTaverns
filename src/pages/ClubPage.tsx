import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Search, Users, Calendar, ExternalLink, MessageSquare, BarChart3, BookOpen, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClub, useClubLibraries, useClubGameSearch, useClubEvents, useSwitchClubLibrary } from "@/hooks/useClubs";
import { useMyLibraries } from "@/hooks/useLibrary";
import { useDebounce } from "@/hooks/useDebounce";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { useAuth } from "@/hooks/useAuth";
import { ClubForumCard } from "@/components/community/ClubForumCard";
import { BackLink } from "@/components/navigation/BackLink";
import { ClubAnalyticsDashboard } from "@/components/analytics/ClubAnalyticsDashboard";
import { ClubLendingDesk } from "@/components/clubs/ClubLendingDesk";
import { useClubLendingSettings } from "@/hooks/useClubLending";
import { useToast } from "@/hooks/use-toast";

import { format } from "date-fns";

export default function ClubPage() {
  const { slug, categorySlug } = useParams<{ slug: string; categorySlug?: string }>();
  const { user } = useAuth();
  const { data: club, isLoading } = useClub(slug || null);
  const { data: clubLibraries = [] } = useClubLibraries(club?.id || null);
  const visibleLibraries = clubLibraries;
  const { data: clubEvents = [] } = useClubEvents(club?.id || null);
  const { data: lendingSettings } = useClubLendingSettings(club?.id || null);

  const [searchQuery, setSearchQuery] = useState("");
  const [switchingLibraryId, setSwitchingLibraryId] = useState<string | null>(null);
  const [newLibraryId, setNewLibraryId] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);
  const { data: games = [], isLoading: searchLoading } = useClubGameSearch(
    club?.id || null,
    debouncedQuery
  );
  const { data: myLibraries = [] } = useMyLibraries();
  const switchLibrary = useSwitchClubLibrary();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading club...</div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
  const showLendingDesk = isOwner && lendingSettings?.lending_enabled;
  const gamesByTitle = new Map<string, typeof games>();
  for (const game of games) {
    const key = game.bgg_id || game.title.toLowerCase();
    if (!gamesByTitle.has(key)) gamesByTitle.set(key, []);
    gamesByTitle.get(key)!.push(game);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <BackLink fallback="/clubs" className="text-cream/70 hover:text-cream" />
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
                  {visibleLibraries.length} {visibleLibraries.length === 1 ? "library" : "libraries"}
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
        <Tabs defaultValue={categorySlug ? "forums" : "catalog"} className="w-full">
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
            <TabsTrigger
              value="analytics"
              className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            {showLendingDesk && (
              <TabsTrigger
                value="lending"
                className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
              >
                <BookOpen className="h-4 w-4" />
                Lending Desk
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Analytics ── */}
          <TabsContent value="analytics">
            <ClubAnalyticsDashboard clubId={club.id} />
          </TabsContent>

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
                {games.length} games across {visibleLibraries.length} libraries
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
                            <TenantLink
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
                            </TenantLink>
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
              {visibleLibraries.map((cl: any) => {
                const isMyLibrary = user && cl.library?.owner_id === user.id;
                const otherLibraries = myLibraries.filter(
                  (l) => l.id !== cl.library_id && !visibleLibraries.some((vl: any) => vl.library_id === l.id)
                );
                const isSwitching = switchingLibraryId === cl.library_id;

                return (
                  <Card
                    key={cl.id}
                    className="bg-wood-medium/30 border-wood-medium/50 text-cream"
                  >
                    <CardHeader>
                      <CardTitle className="text-lg font-display flex items-center gap-2">
                        {cl.library?.name || "Unknown Library"}
                        {isMyLibrary && (
                          <Badge variant="outline" className="text-xs text-cream/60">You</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-cream/60">
                        Joined {format(new Date(cl.joined_at), "MMM d, yyyy")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {cl.library?.slug && (
                        <TenantLink href={getLibraryUrl(cl.library.slug, "/")}>
                          <Button variant="secondary" size="sm" className="gap-2">
                            <ExternalLink className="h-4 w-4" />
                            Visit Library
                          </Button>
                        </TenantLink>
                      )}

                      {/* Switch library option for own library */}
                      {isMyLibrary && otherLibraries.length > 0 && (
                        <div className="pt-2 border-t border-wood-medium/30">
                          {isSwitching ? (
                            <div className="space-y-2">
                              <p className="text-xs text-cream/60">Switch to a different library:</p>
                              <Select value={newLibraryId} onValueChange={setNewLibraryId}>
                                <SelectTrigger className="bg-wood-medium/50 border-border/50 text-cream text-sm h-9">
                                  <SelectValue placeholder="Select library..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {otherLibraries.map((lib) => (
                                    <SelectItem key={lib.id} value={lib.id}>
                                      {lib.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={!newLibraryId || switchLibrary.isPending}
                                  onClick={async () => {
                                    try {
                                      await switchLibrary.mutateAsync({
                                        club_id: club.id,
                                        old_library_id: cl.library_id,
                                        new_library_id: newLibraryId,
                                      });
                                      toast({ title: "Library switched!", description: "Your club library has been updated." });
                                      setSwitchingLibraryId(null);
                                      setNewLibraryId("");
                                    } catch (e: any) {
                                      toast({ title: "Switch failed", description: e.message, variant: "destructive" });
                                    }
                                  }}
                                >
                                  {switchLibrary.isPending ? "Switching..." : "Confirm"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-cream/60"
                                  onClick={() => {
                                    setSwitchingLibraryId(null);
                                    setNewLibraryId("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5 text-cream/60 hover:text-cream text-xs"
                              onClick={() => setSwitchingLibraryId(cl.library_id)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Switch Library
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
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
              activeCategorySlug={categorySlug}
            />
          </TabsContent>
          {/* ── Lending Desk ── */}
          {showLendingDesk && user && (
            <TabsContent value="lending">
              <ClubLendingDesk clubId={club.id} staffUserId={user.id} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
