import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  // These would come from actual aggregated data in production
  // For now, derive what we can from current active loans
  const totalGames = libraryGames.length;
  const totalCopies = libraryGames.reduce((sum: number, g: any) => sum + (g.copies_owned || 1), 0);
  const currentlyOut = activeLoans.length;

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Currently Checked Out" value={currentlyOut} trend="Right now" color="text-primary" />
        <StatCard icon={Package} label="Total Copies" value={totalCopies} trend={`${totalGames} unique games`} color="text-secondary" />
        <StatCard icon={Trophy} label="Unique Games" value={totalGames} trend="In lending library" color="text-accent" />
        <StatCard icon={Users} label="Active Borrowers" value={new Set(activeLoans.map(l => l.guest_name || l.borrower_user_id)).size} trend="Current session" color="text-primary" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Most Popular */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Most Active Games
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

        {/* Publisher Insights Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Publisher Report Card
            </CardTitle>
            <CardDescription>Available after event completion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-primary/5 text-center">
                <p className="text-2xl font-display text-primary">—</p>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/10 text-center">
                <p className="text-2xl font-display text-secondary">{currentlyOut}</p>
                <p className="text-xs text-muted-foreground">Total Checkouts</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/10 text-center">
                <p className="text-2xl font-display text-accent">—</p>
                <p className="text-xs text-muted-foreground">Avg Session</p>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-2xl font-display">—</p>
                <p className="text-xs text-muted-foreground">Replay Rate</p>
              </div>
            </div>
            <div className="text-center py-4">
              <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Detailed publisher analytics will be generated after the event concludes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement note */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Live Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Engagement timeline and historical analytics will populate as the convention runs. Check back during and after the event for detailed reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

  );
}
