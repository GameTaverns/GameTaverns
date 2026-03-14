import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Users, BookOpen, Trophy, TrendingUp, Star,
  BarChart3, Eye, Package, Timer, Gamepad2,
  Flame, Download,
} from "lucide-react";
import { useConventionAllLoans } from "@/hooks/useConventionRealtime";

interface Props {
  event: any;
  activeLoans: any[];
  libraryGames: any[];
}

export function ConventionAnalytics({ event, activeLoans, libraryGames }: Props) {
  // Fetch ALL loans (active + returned) scoped to this convention's date range
  const { data: allLoans = [] } = useConventionAllLoans(
    event?.library_id,
    event?.event_date,
    event?.end_date,
  );

  const totalGames = libraryGames.length;
  const totalCopies = libraryGames.reduce((sum: number, g: any) => sum + (g.copies_owned || 1), 0);
  const currentlyOut = activeLoans.length;
  const totalCheckouts = allLoans.length;
  const returnedLoans = allLoans.filter((l: any) => l.status === "returned");
  const uniqueBorrowers = new Set(allLoans.map(l => l.guest_name || l.borrower_user_id)).size;
  const uniqueGamesPlayed = new Set(allLoans.map(l => l.game_id)).size;

  // Group ALL loans by game for popularity (lifetime, not just active)
  const loansByGame = useMemo(() => {
    const map = new Map<string, { title: string; count: number; image_url: string | null }>();
    for (const loan of allLoans) {
      const title = loan.game?.title || "Unknown";
      const existing = map.get(loan.game_id) || { title, count: 0, image_url: loan.game?.image_url };
      existing.count++;
      map.set(loan.game_id, existing);
    }
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [allLoans]);

  // Least checked out games
  const leastPlayed = useMemo(() => {
    const loanCounts = new Map<string, number>();
    for (const loan of allLoans) {
      loanCounts.set(loan.game_id, (loanCounts.get(loan.game_id) || 0) + 1);
    }
    return libraryGames
      .map((g: any) => ({ ...g, checkouts: loanCounts.get(g.id) || 0 }))
      .sort((a: any, b: any) => a.checkouts - b.checkouts)
      .slice(0, 4);
  }, [allLoans, libraryGames]);

  // Hourly activity from ALL loan timestamps
  const hourlyActivity = useMemo(() => {
    const hours: { hour: string; loans: number }[] = [];
    for (let h = 8; h <= 22; h++) {
      const label = h <= 11 ? `${h}AM` : h === 12 ? `12PM` : `${h - 12}PM`;
      const count = allLoans.filter(l => new Date(l.checked_out_at).getHours() === h).length;
      hours.push({ hour: label, loans: count });
    }
    return hours;
  }, [allLoans]);
  const maxHourly = Math.max(1, ...hourlyActivity.map(h => h.loans));

  // Average session time from returned loans
  const avgSessionTime = useMemo(() => {
    if (returnedLoans.length === 0) return "—";
    const totalMins = returnedLoans.reduce((sum: number, l: any) => {
      if (!l.returned_at) return sum;
      const diffMs = new Date(l.returned_at).getTime() - new Date(l.checked_out_at).getTime();
      return sum + Math.floor(diffMs / 60000);
    }, 0);
    const avg = Math.round(totalMins / returnedLoans.length);
    if (avg < 60) return `${avg}m`;
    return `${Math.floor(avg / 60)}h ${avg % 60}m`;
  }, [returnedLoans]);

  // Export CSV
  const exportCSV = () => {
    const headers = ["Game", "Borrower", "Checked Out", "Returned", "Duration (min)", "Condition Out", "Condition In"];
    const rows = allLoans.map((l: any) => {
      const duration = l.returned_at
        ? Math.round((new Date(l.returned_at).getTime() - new Date(l.checked_out_at).getTime()) / 60000)
        : "Active";
      return [
        l.game?.title || "Unknown",
        l.guest_name || l.borrower_user_id || "—",
        new Date(l.checked_out_at).toLocaleString(),
        l.returned_at ? new Date(l.returned_at).toLocaleString() : "—",
        duration,
        l.condition_out || "—",
        l.condition_in || "—",
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `convention-report-${event?.title?.replace(/\s+/g, "-") || "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Checkouts", value: totalCheckouts, sub: `${currentlyOut} active now`, icon: BookOpen, color: "text-primary" },
          { label: "Unique Games Played", value: uniqueGamesPlayed, sub: `of ${totalGames} available`, icon: Gamepad2, color: "text-secondary" },
          { label: "Avg Session Time", value: avgSessionTime, sub: `${returnedLoans.length} returned`, icon: Timer, color: "text-accent" },
          { label: "Unique Borrowers", value: uniqueBorrowers, sub: "All time", icon: Users, color: "text-secondary" },
        ].map(m => (
          <Card key={m.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <span className="text-[10px] text-muted-foreground">{m.sub}</span>
              </div>
              <p className="text-2xl font-display">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Most Checked Out — main panel */}
        <Card className="lg:col-span-2 border-secondary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-secondary" />
                Most Checked Out
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> Lifetime
              </Badge>
            </div>
            <CardDescription className="text-xs">Games ranked by total checkouts — exportable for publisher reports</CardDescription>
          </CardHeader>
          <CardContent>
            {loansByGame.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No checkout data yet</p>
            ) : (
              <div className="space-y-2">
                {loansByGame.slice(0, 10).map((game, i) => (
                  <div key={game.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium text-muted-foreground w-4 text-right">{i + 1}</span>
                        <span className="text-sm font-medium truncate">{game.title}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{game.count} checkout{game.count !== 1 ? "s" : ""}</Badge>
                    </div>
                    <div className="ml-6">
                      <Progress value={(game.count / Math.max(1, loansByGame[0]?.count)) * 100} className="h-1.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t flex justify-end">
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={exportCSV}>
                <Download className="h-3 w-3" /> Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {/* Hourly Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-primary" /> Hourly Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allLoans.length > 0 ? (
                <div>
                  <div className="flex items-end gap-0.5 h-24">
                    {hourlyActivity.map(h => {
                      const heightPct = (h.loans / maxHourly) * 100;
                      return (
                        <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5">
                          {h.loans > 0 && <span className="text-[8px] text-muted-foreground">{h.loans}</span>}
                          <div
                            className="w-full rounded-t bg-primary/60 transition-all"
                            style={{ height: `${heightPct}%`, minHeight: h.loans > 0 ? 4 : 2 }}
                          />
                          <span className="text-[7px] text-muted-foreground">{h.hour}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">Activity will appear as games are checked out</p>
              )}
            </CardContent>
          </Card>

          {/* Utilization */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-accent" /> Utilization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-primary/5 text-center">
                  <p className="text-2xl font-display text-primary">{uniqueGamesPlayed}</p>
                  <p className="text-[10px] text-muted-foreground">Games Played</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-display">{totalCopies > 0 ? Math.round((uniqueGamesPlayed / totalGames) * 100) : 0}%</p>
                  <p className="text-[10px] text-muted-foreground">Game Coverage</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Least Played */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-destructive" /> Least Checked Out
              </CardTitle>
              <CardDescription className="text-[10px]">Low engagement — consider shelf placement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {leastPlayed.map((g: any) => (
                <div key={g.id} className="flex items-center justify-between p-2 rounded bg-muted/40">
                  <p className="text-sm font-medium truncate">{g.title}</p>
                  <Badge variant="outline" className="text-[10px]">{g.checkouts} loans</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
