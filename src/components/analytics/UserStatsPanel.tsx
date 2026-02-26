import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { Trophy, Swords, Users, Target, TrendingUp, Gamepad2, Flame, Calendar, Clock } from "lucide-react";
import { useUserProfileStats } from "@/hooks/useUserProfileStats";
import { formatDistanceToNow } from "date-fns";

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
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data) return null;

  const hasElo = data.globalElo !== null;
  const rank = hasElo ? getRank(data.globalElo!) : null;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {hasElo && (
          <SummaryCardThemed icon={Trophy} label="ELO Rating" value={data.globalElo!} style={cardStyle}>
            {rank && <Badge variant="secondary" className={`text-[10px] mt-1 ${rank.color}`}>{rank.name}</Badge>}
          </SummaryCardThemed>
        )}
        <SummaryCardThemed icon={Gamepad2} label="Ranked Games" value={data.totalGamesPlayed} style={cardStyle} />
        <SummaryCardThemed icon={Target} label="Win Rate" value={`${data.overallWinRate}%`} style={cardStyle} />
        <SummaryCardThemed icon={Calendar} label="Total Sessions" value={data.totalSessions} style={cardStyle} />
        <SummaryCardThemed icon={Layers} label="Unique Games" value={data.uniqueGamesPlayed} style={cardStyle} />
        <SummaryCardThemed icon={Clock} label="Avg Plays/Month" value={data.avgSessionsPerMonth} style={cardStyle} />
        <SummaryCardThemed icon={Flame} label="Current Streak" value={`${data.currentStreak}d`} style={cardStyle} />
        {hasElo && <SummaryCardThemed icon={TrendingUp} label="Peak ELO" value={data.peakElo!} style={cardStyle} />}
        {!hasElo && <SummaryCardThemed icon={Flame} label="Best Streak" value={`${data.longestStreak}d`} style={cardStyle} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Day of week heatmap */}
        {data.dayOfWeekDistribution.some((d) => d.count > 0) && (
          <Card className="backdrop-blur-sm border-border" style={cardStyle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Play Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-1 h-24">
                {data.dayOfWeekDistribution.map((d) => {
                  const max = Math.max(...data.dayOfWeekDistribution.map((x) => x.count), 1);
                  const pct = (d.count / max) * 100;
                  return (
                    <div key={d.day} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full rounded-t" style={{ height: `${Math.max(pct, 4)}%`, backgroundColor: d.count > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))" }} />
                      <span className="text-[10px] text-muted-foreground">{d.day}</span>
                      <span className="text-[10px] font-medium text-foreground">{d.count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly play trend */}
        {data.monthlyPlayTrend.length > 1 && (
          <Card className="backdrop-blur-sm border-border" style={cardStyle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Monthly Play Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={data.monthlyPlayTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="month" tick={tickStyle} />
                  <YAxis allowDecimals={false} tick={tickStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* ELO by game */}
        {data.eloByGame.length > 0 && (
          <Card className="backdrop-blur-sm border-border" style={cardStyle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
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
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Most Played With
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.min(data.playedWith.length * 30 + 20, 220)}>
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

      {/* Recent games + preferences row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent games */}
        {data.recentGames.length > 0 && (
          <Card className="backdrop-blur-sm border-border" style={cardStyle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Recent Games
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.recentGames.map((g, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground truncate block">{g.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(g.playedAt), { addSuffix: true })}
                      </span>
                    </div>
                    {g.result && (
                      <Badge variant={g.result === "Won" ? "secondary" : "outline"} className="text-[10px] ml-2">
                        {g.result}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Game type preferences */}
        {data.topCategories.length > 0 && (
          <Card className="backdrop-blur-sm border-border" style={cardStyle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Game Preferences</CardTitle>
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
      </div>

      {/* No data state */}
      {!hasElo && data.playedWith.length === 0 && data.topCategories.length === 0 && data.totalSessions === 0 && (
        <Card className="backdrop-blur-sm border-border" style={cardStyle}>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No ranked games or linked sessions yet. Play and tag to build your stats!
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Needed for the Layers icon import at top
import { Layers } from "lucide-react";

function SummaryCardThemed({ icon: Icon, label, value, style, children }: {
  icon: any; label: string; value: string | number; style: React.CSSProperties; children?: React.ReactNode;
}) {
  return (
    <Card className="backdrop-blur-sm border-border" style={style}>
      <CardContent className="p-3 text-center">
        <Icon className="h-4 w-4 mx-auto mb-1 text-primary" />
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        {children}
      </CardContent>
    </Card>
  );
}
