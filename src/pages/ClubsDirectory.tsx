import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/seo/SEO";
import { Layout } from "@/components/layout/Layout";
import { usePublicClubs } from "@/hooks/useClubs";
import { useClubLibraries } from "@/hooks/useClubs";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Users, ArrowLeft, ArrowRight, Building2, Globe, Plus, Ticket,
} from "lucide-react";
import type { Club } from "@/hooks/useClubs";

function ClubCard({ club }: { club: Club }) {
  const initials = club.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link to={`/club/${club.slug}`}>
      <Card className="bg-card/60 border-border/50 hover:border-secondary/50 transition-all group cursor-pointer h-full">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 rounded-xl flex-shrink-0 border border-border/30">
              <AvatarImage src={club.logo_url || undefined} alt={club.name} className="object-cover" />
              <AvatarFallback className="rounded-xl bg-secondary/20 text-secondary font-display text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-foreground truncate group-hover:text-secondary transition-colors">
                  {club.name}
                </h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
              {club.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {club.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Globe className="h-3 w-3" /> Public
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ClubsDirectory() {
  const { user } = useAuth();
  const { data: clubs = [], isLoading } = usePublicClubs();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClubs = useMemo(() => {
    if (!searchQuery.trim()) return clubs;
    const q = searchQuery.toLowerCase();
    return clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    );
  }, [clubs, searchQuery]);

  return (
    <Layout hideSidebar>
      <SEO
        title="Club Directory"
        description="Discover board game clubs on GameTaverns. Browse clubs, join communities, and connect with fellow gamers."
      />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          {user && (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3 mb-2">
                <Building2 className="h-7 w-7 text-secondary" />
                Club Directory
              </h1>
              <p className="text-muted-foreground">
                Discover board game clubs — shared catalogs, events, and cross-library forums
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link to="/join-club">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Ticket className="h-4 w-4" /> Join
                </Button>
              </Link>
              <Link to="/request-club">
                <Button size="sm" className="gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  <Plus className="h-4 w-4" /> Request Club
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clubs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : filteredClubs.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="font-display text-xl text-foreground mb-2">
              {searchQuery ? "No clubs found" : "No public clubs yet"}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {searchQuery
                ? "Try a different search term"
                : "Be the first to create a club and build a community!"}
            </p>
            <Link to="/request-club">
              <Button className="bg-secondary text-secondary-foreground gap-2">
                <Plus className="h-4 w-4" /> Request a Club
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredClubs.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        )}

        {/* Link to Library Directory */}
        <div className="mt-12 border-t border-border/50 pt-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg text-foreground mb-1">Looking for individual libraries?</h2>
              <p className="text-sm text-muted-foreground">Browse the Library Directory to find game collections near you</p>
            </div>
            <Link to="/directory">
              <Button variant="outline" className="gap-2">
                <Users className="h-4 w-4" /> Library Directory
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
