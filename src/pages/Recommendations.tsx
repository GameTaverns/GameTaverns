import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { BackLink } from "@/components/navigation/BackLink";
import { useAuth } from "@/hooks/useAuth";
import { usePeopleRecommendations } from "@/hooks/usePeopleRecommendations";
import { FollowButton } from "@/components/social/FollowButton";
import { UserLink } from "@/components/social/UserLink";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sparkles, Gamepad2, Users, Puzzle, LogIn, Library } from "lucide-react";

const ARCHETYPE_EMOJI: Record<string, string> = {
  "Grand Strategist": "♟️",
  "Architect": "🏗️",
  "Diplomat": "🤝",
  "Entertainer": "🎭",
  "Euro Purist": "📊",
  "Cozy Gamer": "☕",
  "War Gamer": "⚔️",
  "Collector": "📚",
  "Explorer": "🧭",
  "Storyteller": "📖",
  "Competitor": "🏆",
  "Social Butterfly": "🦋",
};

export default function Recommendations() {
  const { user } = useAuth();
  const { data: recommendations, isLoading } = usePeopleRecommendations();

  const getInitials = (name: string | null, username: string) =>
    (name || username || "?")
      .split(" ")
      .map((s) => s[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <Layout hideSidebar>
      <SEO
        title="Discover People"
        description="Find gamers with similar tastes based on your collection and play style."
        canonical="https://hobby-shelf-spark.lovable.app/recommendations"
      />
      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {user && <BackLink fallback="/dashboard" />}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-7 w-7 text-primary" />
            <h1 className="font-display text-3xl font-bold text-foreground">
              Discover People
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            People who share your gaming DNA — matched by collection mechanics,
            play style archetypes, and the games you love.
          </p>
        </div>

        {/* Not logged in */}
        {!user && (
          <Card className="max-w-md mx-auto mt-12">
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <LogIn className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                Sign in to get personalized recommendations based on your collection.
              </p>
              <Link to="/login">
                <Button>Sign In</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {user && isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {user && !isLoading && (!recommendations || recommendations.length === 0) && (
          <div className="text-center py-16">
            <Users className="h-14 w-14 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No recommendations yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Add more games to your collection and log some plays — we'll match
              you with gamers who share your taste.
            </p>
          </div>
        )}

        {/* Results */}
        {user && !isLoading && recommendations && recommendations.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recommendations.map((rec) => (
              <Card
                key={rec.user_id}
                className="group hover:shadow-md transition-shadow"
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={rec.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(rec.display_name, rec.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <UserLink
                        username={rec.username}
                        displayName={rec.display_name}
                        className="font-medium text-foreground block truncate"
                      />
                      <p className="text-xs text-muted-foreground">
                        @{rec.username}
                      </p>
                    </div>
                    <FollowButton
                      currentUserId={user.id}
                      targetUserId={rec.user_id}
                    />
                  </div>

                  {rec.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {rec.bio}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {rec.primary_archetype && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        {ARCHETYPE_EMOJI[rec.primary_archetype] || "🎲"}{" "}
                        {rec.primary_archetype}
                      </Badge>
                    )}
                    {rec.shared_mechanics > 0 && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Puzzle className="h-3 w-3" />
                        {rec.shared_mechanics} shared mechanic{rec.shared_mechanics !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {rec.shared_games > 0 && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Library className="h-3 w-3" />
                        {rec.shared_games} shared game{rec.shared_games !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>

                  {rec.top_shared_games && rec.top_shared_games.length > 0 && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
                      🎲 {rec.top_shared_games.join(", ")}
                      {rec.shared_games > 3 && ` +${rec.shared_games - 3} more`}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Gamepad2 className="h-3.5 w-3.5" />
                      {rec.games_owned ?? 0} games
                    </span>
                    <span>{rec.sessions_logged ?? 0} plays</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
