import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Users, BookOpen, CalendarClock, Trophy, TrendingUp, Star,
  BarChart3, Sparkles, Eye, Package,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, trend, color }: {
  icon: any; label: string; value: string | number; trend: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <Icon className={`h-5 w-5 ${color}`} />
          <span className="text-xs text-muted-foreground">{trend}</span>
        </div>
        <p className="text-2xl font-display">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

interface Props {
  event: any;
  activeLoans: any[];
  libraryGames: any[];
}

export function ConventionAnalytics({ event, activeLoans, libraryGames }: Props) {
  const totalGames = libraryGames.length;
  const totalCopies = libraryGames.reduce((sum: number, g: any) => sum + (g.copies_owned || 1), 0);
  const currentlyOut = activeLoans.length;
  const uniqueBorrowers = new Set(activeLoans.map(l => l.guest_name || l.borrower_user_id)).size;
  const uniqueGamesOut = new Set(activeLoans.map(l => l.game_id)).size;

  // Group loans by game for popularity
  const loansByGame = useMemo(() => {
    const map = new Map<string, { title: string; count: number; image_url: string | null }>();
    for (const loan of activeLoans) {
      const title = loan.game?.title || "Unknown";
      const existing = map.get(loan.game_id) || { title, count: 0, image_url: loan.game?.image_url };
      existing.count++;
      map.set(loan.game_id, existing);
    }
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [activeLoans]);

  // Simulated hourly data from loan timestamps (group by hour)
  const hourlyActivity = useMemo(() => {
    const hours = new Array(16).fill(0); // 8am - 11pm
    for (const loan of activeLoans) {
      const hour = new Date(loan.checked_out_at).getHours();
      const idx = Math.max(0, Math.min(15, hour - 8));
      hours[idx]++;
    }
    return hours;
  }, [activeLoans]);
  const maxHourly = Math.max(1, ...hourlyActivity);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Currently Checked Out" value={currentlyOut} trend="Right now" color="text-primary" />
        <StatCard icon={Package} label="Total Copies" value={totalCopies} trend={`${totalGames} unique games`} color="text-secondary" />
        <StatCard icon={Trophy} label="Games in Play" value={uniqueGamesOut} trend={`of ${totalGames} available`} color="text-accent" />
        <StatCard icon={Users} label="Active Borrowers" value={uniqueBorrowers} trend="Current session" color="text-primary" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Most Popular */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Most Popular Games
            </CardTitle>
            <CardDescription>By current checkouts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loansByGame.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No checkout data yet</p>
            ) : (
              loansByGame.slice(0, 5).map((game, i) => (
                <div key={game.id} className="flex items-center gap-3">
                  <span className="text-lg font-display text-muted-foreground w-6 text-right">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{game.title}</p>
                      <Badge variant="secondary" className="text-xs">{game.count} out</Badge>
                    </div>
                    <Progress value={(game.count / Math.max(1, loansByGame[0]?.count)) * 100} className="h-1 mt-1" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Publisher Report Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Publisher Report Card
            </CardTitle>
            <CardDescription>Aggregated event metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-primary/5 text-center">
                <p className="text-2xl font-display text-primary">{uniqueGamesOut}</p>
                <p className="text-xs text-muted-foreground">Unique Titles in Play</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/10 text-center">
                <p className="text-2xl font-display text-secondary">{currentlyOut}</p>
                <p className="text-xs text-muted-foreground">Total Checkouts</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/10 text-center">
                <p className="text-2xl font-display text-accent">{uniqueBorrowers}</p>
                <p className="text-xs text-muted-foreground">Unique Players</p>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-2xl font-display">{totalCopies > 0 ? Math.round((currentlyOut / totalCopies) * 100) : 0}%</p>
                <p className="text-xs text-muted-foreground">Utilization Rate</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Key Insight</p>
              <p className="text-sm">
                <Sparkles className="h-3.5 w-3.5 inline mr-1 text-secondary" />
                {loansByGame.length > 0
                  ? `${loansByGame[0].title} is the most popular game with ${loansByGame[0].count} active checkout${loansByGame[0].count > 1 ? 's' : ''}. This data provides publisher-grade engagement metrics impossible to get elsewhere.`
                  : "Start checking out games to see real-time publisher engagement insights here."
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Engagement Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentlyOut > 0 ? (
            <>
              <div className="flex items-end gap-1 h-32">
                {hourlyActivity.map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-primary to-primary/60 min-h-[2px]"
                      style={{ height: `${(v / maxHourly) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
                <span>8am</span>
                <span>12pm</span>
                <span>4pm</span>
                <span>11pm</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Engagement timeline will populate as games are checked out. Check back during the event for detailed reports.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
