import { Link } from "react-router-dom";
import { BackLink } from "@/components/navigation/BackLink";
import { AppHeader } from "@/components/layout/AppHeader";
import { LeaderboardTable } from "@/components/achievements/LeaderboardTable";
import { RankBadge } from "@/components/achievements/RankBadge";
import { RANKS } from "@/lib/ranks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown, Info } from "lucide-react";
import { SEO } from "@/components/seo/SEO";

export default function Leaderboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark">
      <SEO
        title="Leaderboard | GameTaverns"
        description="See who's leading the pack! Top collectors, players, and contributors ranked by achievement points."
      />
      <AppHeader />

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <BackLink fallback="/dashboard" className="text-cream/70 hover:text-cream" />

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-cream flex items-center gap-3">
                <Crown className="h-7 w-7 text-yellow-500" />
                Leaderboard
              </h1>
              <p className="text-cream/60 text-sm mt-1">
                Top collectors, players & contributors
              </p>
            </div>
            <Link to="/achievements">
              <Badge variant="outline" className="gap-1.5 border-cream/20 text-cream/70 hover:text-cream cursor-pointer">
                <Trophy className="h-3.5 w-3.5" />
                My Achievements
              </Badge>
            </Link>
          </div>

          {/* Rank legend */}
          <Card className="bg-card/90 backdrop-blur-sm border-border">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Info className="h-4 w-4" />
                Rank Tiers
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="flex flex-wrap gap-2">
                {RANKS.map((rank) => (
                  <Badge
                    key={rank.name}
                    variant="secondary"
                    className={`${rank.color} bg-card border border-border text-xs gap-1`}
                  >
                    {rank.icon} {rank.name}
                    <span className="text-muted-foreground ml-1">{rank.minPoints}+</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card className="bg-card/90 backdrop-blur-sm border-border">
            <CardContent className="p-2 sm:p-4">
              <LeaderboardTable />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
