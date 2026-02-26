import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Trophy, Swords, Users, Target, TrendingUp, Gamepad2 } from "lucide-react";
import { useUserProfileStats } from "@/hooks/useUserProfileStats";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--card-foreground))",
  fontSize: "12px",
};

const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

function getRank(elo: number): { name: string; color: string } {
  if (elo >= 1800) return { name: "Elite", color: "text-yellow-400" };
  if (elo >= 1500) return { name: "Expert", color: "text-purple-400" };
  if (elo >= 1200) return { name: "Advanced", color: "text-blue-400" };
  if (elo >= 1000) return { name: "Intermediate", color: "text-green-400" };
  return { name: "Beginner", color: "text-muted-foreground" };
}

interface Props {
  userId: string;
  hasTheme?: boolean;
  profileBgColor?: string | null;
}

export function UserStatsPanel({ userId, hasTheme, profileBgColor }: Props) {
  const { data, isLoading } = useUserProfileStats(userId);

  const cardStyle = hasTheme && profileBgColor ? { backgroundColor: profileBgColor } : { backgroundColor: 'hsl(var(--card) / 0.9)' };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data) return null;

  const hasElo = data.globalElo !== null;
  const rank = hasElo ? getRank(data.globalElo!) : null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {hasElo && (
          <Card className="backdrop-blur-sm border-border" style={cardStyle}>
            <CardContent className="p-3 text-center">
              <Trophy className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold text-foreground">{data.globalElo}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ELO Rating</div>
              {rank && <Badge variant="secondary" className={`text-[10px] mt-1 ${rank.color}`}>{rank.name}</Badge>}
            </CardContent>
          </Card>
        )}
        <Card className="backdrop-blur-sm border-border" style={cardStyle}>
          <CardContent className="p-3 text-center">
            <Gamepad2 className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-foreground">{data.totalGamesPlayed}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ranked Games</div>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-sm border-border" style={cardStyle}>
          <CardContent className="p-3 text-center">
            <Target className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-foreground">{data.overallWinRate}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Win Rate</div>
          </CardContent>
        </Card>
        {hasElo && (
          <Card className="backdrop-blur-sm border-border" style={cardStyle}>
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold text-foreground">{data.peakElo}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Peak ELO</div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ELO by game */}
        {data.eloByGame.length > 0 && (
          <Card className="backdrop-blur-sm border-border" style={cardStyle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Swords className="h-4 w-4 text-primary" />
                ELO by Game
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.eloByGame.map((g) => {
                  const r = getRank(g.elo);
                  return (
                    <div key={g.gameTitle} className="flex items-center justify-between">
                      <span className="text-sm text-foreground truncate flex-1 mr-2">{g.gameTitle}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-sm font-bold ${r.color}`}>{g.elo}</span>
                        <span className="text-[10px] text-muted-foreground">{g.wins}W/{g.losses}L</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Played with */}
        {data.playedWith.length > 0 && (
          <Card className="backdrop-blur-sm border-border" style={cardStyle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Most Played With
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.min(data.playedWith.length * 30 + 20, 200)}>
                <BarChart data={data.playedWith} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis type="number" allowDecimals={false} tick={tickStyle} />
                  <YAxis dataKey="name" type="category" tick={tickStyle} width={80} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="sessions" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Game type preferences */}
      {data.topCategories.length > 0 && (
        <Card className="backdrop-blur-sm border-border" style={cardStyle}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Game Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.topCategories.map((cat) => (
                <Badge key={cat.category} variant="secondary" className="text-xs capitalize">
                  {cat.category} ({cat.count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No data state */}
      {!hasElo && data.playedWith.length === 0 && data.topCategories.length === 0 && (
        <Card className="backdrop-blur-sm border-border" style={cardStyle}>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No ranked games or linked sessions yet. Play and tag to build your stats!
          </CardContent>
        </Card>
      )}
    </div>
  );
}
