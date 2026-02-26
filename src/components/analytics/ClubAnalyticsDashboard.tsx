import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Users, Calendar, Gamepad2, Trophy, BarChart3, Layers, TrendingUp, Share2 } from "lucide-react";
import { useClubAnalytics } from "@/hooks/useClubAnalytics";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--card-foreground))",
  fontSize: "12px",
};

const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
  "hsl(30 60% 50%)",
  "hsl(200 60% 50%)",
  "hsl(340 60% 50%)",
  "hsl(160 60% 50%)",
];

interface Props {
  clubId: string;
}

export function ClubAnalyticsDashboard({ clubId }: Props) {
  const { data, isLoading } = useClubAnalytics(clubId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary cards — 2 rows of 4 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={Users} label="Members" value={data.totalMembers} />
        <SummaryCard icon={Gamepad2} label="Total Games" value={data.totalGamesAcrossLibraries} />
        <SummaryCard icon={Layers} label="Unique Titles" value={data.uniqueTitles} />
        <SummaryCard icon={TrendingUp} label="Total Plays" value={data.totalSessionsAcrossClub} />
        <SummaryCard icon={Calendar} label="Events" value={data.totalEvents} />
        <SummaryCard icon={Calendar} label="Upcoming" value={data.upcomingEvents} accent />
        <SummaryCard icon={BarChart3} label="Avg Games/Member" value={data.avgGamesPerMember} />
        <SummaryCard icon={BarChart3} label="Avg Plays/Member" value={data.avgSessionsPerMember} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Most played */}
        {data.topGamesAcrossClub.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Most Played Across Club
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.min(data.topGamesAcrossClub.length * 28 + 20, 280)}>
                <BarChart data={data.topGamesAcrossClub} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis type="number" allowDecimals={false} tick={tickStyle} />
                  <YAxis dataKey="title" type="category" tick={tickStyle} width={110} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Game type diversity pie */}
        {data.gameDiversity.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Game Type Diversity
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={data.gameDiversity} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {data.gameDiversity.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {data.gameDiversity.map((d, i) => (
                  <div key={d.label} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-foreground capitalize truncate flex-1">{d.label}</span>
                    <span className="text-muted-foreground">{d.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Play trend over time */}
        {data.recentSessionTrend.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Play Activity Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.recentSessionTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="date" tick={tickStyle} />
                  <YAxis allowDecimals={false} tick={tickStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Player count distribution */}
        {data.playerCountDistribution.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Player Count Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.playerCountDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="label" tick={tickStyle} />
                  <YAxis allowDecimals={false} tick={tickStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Shared games across members */}
        {data.sharedGames.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" />
                Games Owned by Multiple Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.sharedGames.map((g) => (
                  <div key={g.title} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-sm text-foreground truncate flex-1">{g.title}</span>
                    <Badge variant="secondary" className="text-[10px]">{g.owners} owners</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Member activity table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Member Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.memberActivity.map((member) => (
                <div key={member.libraryName} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-sm text-foreground truncate flex-1">{member.libraryName}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="secondary" className="text-[10px]">{member.gamesCount} games</Badge>
                    <Badge variant="outline" className="text-[10px]">{member.sessionsCount} plays</Badge>
                  </div>
                </div>
              ))}
              {data.memberActivity.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No member data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: boolean }) {
  return (
    <Card className="bg-card/50">
      <CardContent className="p-3 text-center">
        <Icon className={`h-4 w-4 mx-auto mb-1 ${accent ? "text-accent-foreground" : "text-primary"}`} />
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
