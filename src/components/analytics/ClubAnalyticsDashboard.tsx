import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Users, Calendar, Gamepad2, Trophy, BarChart3 } from "lucide-react";
import { useClubAnalytics } from "@/hooks/useClubAnalytics";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--card-foreground))",
  fontSize: "12px",
};

const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

interface Props {
  clubId: string;
}

export function ClubAnalyticsDashboard({ clubId }: Props) {
  const { data, isLoading } = useClubAnalytics(clubId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/50">
          <CardContent className="p-3 text-center">
            <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-foreground">{data.totalMembers}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Member Libraries</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 text-center">
            <Gamepad2 className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-foreground">{data.totalGamesAcrossLibraries}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Games</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-foreground">{data.totalEvents}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Events</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-accent-foreground" />
            <div className="text-2xl font-bold text-foreground">{data.upcomingEvents}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Upcoming</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top games across club */}
        {data.topGamesAcrossClub.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Most Played Across Club
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.topGamesAcrossClub.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis type="number" allowDecimals={false} tick={tickStyle} />
                  <YAxis dataKey="title" type="category" tick={tickStyle} width={100} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Member activity table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
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
                    <Badge variant="secondary" className="text-[10px]">
                      {member.gamesCount} games
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {member.sessionsCount} plays
                    </Badge>
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
