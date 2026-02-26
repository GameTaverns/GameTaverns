import { useCallback, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlayStats, StatsPeriod } from "@/hooks/usePlayStats";
import { usePlayAnalytics } from "@/hooks/playStats/usePlayAnalytics";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { isSelfHostedSupabaseStack } from "@/integrations/backend/client";
import { PlayHistoryImportDialog } from "@/components/games/PlayHistoryImportDialog";
import {
  DayOfWeekChart,
  PlaysTrendChart,
  PlayerCountChart,
  PlayerWinRateChart,
  PlayCalendarHeatmap,
  PlayStreakStats,
} from "@/components/stats/PlayAnalyticsCharts";
import { 
  ChevronLeft, 
  ChevronRight, 
  Dices, 
  Users, 
  Clock, 
  Calendar,
  TrendingUp,
  Gamepad2,
  Sparkles,
  Hash,
  Download
} from "lucide-react";
import { format, addMonths, subMonths, addYears, subYears } from "date-fns";
import { GameImage } from "@/components/games/GameImage";

function StatCard({ 
  value, 
  label, 
  icon: Icon 
}: { 
  value: string | number; 
  label: string; 
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardContent className="p-4 text-center">
        {Icon && (
          <Icon className="h-5 w-5 mx-auto mb-1 text-primary/70" />
        )}
        <div className="text-3xl font-bold text-foreground font-display">
          {value}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

function MechanicsList({ 
  mechanics 
}: { 
  mechanics: { name: string; percentage: number; count: number }[] 
}) {
  if (mechanics.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-4">
        No mechanics data available
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {mechanics.map((m) => (
        <div key={m.name} className="flex justify-between items-center">
          <span className="text-sm text-foreground truncate flex-1 mr-2">
            {m.name}
          </span>
          <span className="text-sm font-semibold text-primary">
            {m.percentage}%
          </span>
        </div>
      ))}
    </div>
  );
}

function TopGamesList({ 
  games 
}: { 
  games: { id: string; title: string; image_url: string | null; plays: number }[] 
}) {
  if (games.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-4">
        No games played this month
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {games.slice(0, 5).map((game, index) => (
        <div key={game.id} className="flex items-center gap-3">
          <span className="text-lg font-bold text-muted-foreground w-5">
            {index + 1}
          </span>
          <div className="h-10 w-10 rounded overflow-hidden flex-shrink-0">
            <GameImage
              imageUrl={game.image_url || ""}
              alt={game.title}
              className="h-full w-full object-cover"
            />
          </div>
          <span className="text-sm text-foreground truncate flex-1">
            {game.title}
          </span>
          <span className="text-sm font-semibold text-primary">
            {game.plays}
          </span>
        </div>
      ))}
    </div>
  );
}

function GameImageGrid({ 
  games 
}: { 
  games: { id: string; title: string; image_url: string | null; plays: number }[] 
}) {
  const displayGames = games.slice(0, 9);
  
  if (displayGames.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
      {displayGames.map((game) => (
        <div key={game.id} className="aspect-square relative group">
          <GameImage
            imageUrl={game.image_url || ""}
            alt={game.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs text-center px-1 line-clamp-2">
              {game.title}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

const PLAY_HISTORY_IMPORT_DIALOG_KEY = "play_history_import_dialog_open";

export default function PlayStatsPage() {
  const { library, isOwner } = useTenant();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [showPlayImport, setShowPlayImportRaw] = useState(() => {
    try {
      return sessionStorage.getItem(PLAY_HISTORY_IMPORT_DIALOG_KEY) === "true";
    } catch {
      return false;
    }
  });
  const setShowPlayImport = useCallback((open: boolean) => {
    setShowPlayImportRaw(open);
    try {
      sessionStorage.setItem(PLAY_HISTORY_IMPORT_DIALOG_KEY, String(open));
    } catch {
      // Ignore storage errors (private browsing, quota, etc.)
    }
  }, []);
  
  const isSelfHosted = isSelfHostedSupabaseStack();
  
  const { data: stats, isLoading, error } = usePlayStats(
    library?.id || null,
    selectedDate,
    period
  );

  const { data: analytics, isLoading: analyticsLoading } = usePlayAnalytics(
    library?.id || null,
    selectedDate,
    period
  );

  const handlePrev = () => {
    if (period === "month") {
      setSelectedDate((prev) => subMonths(prev, 1));
    } else {
      setSelectedDate((prev) => subYears(prev, 1));
    }
  };

  const handleNext = () => {
    if (period === "month") {
      const next = addMonths(selectedDate, 1);
      if (next <= new Date()) setSelectedDate(next);
    } else {
      const next = addYears(selectedDate, 1);
      if (next <= new Date()) setSelectedDate(next);
    }
  };

  const canGoNext = period === "month" 
    ? addMonths(selectedDate, 1) <= new Date()
    : addYears(selectedDate, 1) <= new Date();
  
  const displayLabel = period === "month" 
    ? format(selectedDate, "MMM yyyy") 
    : format(selectedDate, "yyyy");

  if (!user || !isOwner) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">Only library owners can view play statistics.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-display text-foreground">Play Stats</h1>
            <p className="text-muted-foreground">Your gaming activity summary</p>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            {isSelfHosted && (
              <Button variant="outline" size="sm" onClick={() => setShowPlayImport(true)}>
                <Download className="h-4 w-4 mr-2" />
                Import from BGG
              </Button>
            )}
            
            <Tabs value={period} onValueChange={(v) => setPeriod(v as StatsPeriod)}>
              <TabsList>
                <TabsTrigger value="month">Monthly</TabsTrigger>
                <TabsTrigger value="year">Annual</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[100px] text-center">
                <span className="text-lg font-semibold text-foreground">{displayLabel}</span>
              </div>
              <Button variant="outline" size="icon" onClick={handleNext} disabled={!canGoNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <PlayHistoryImportDialog open={showPlayImport} onOpenChange={setShowPlayImport} />

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-destructive">
              Failed to load statistics
            </CardContent>
          </Card>
        ) : stats ? (
          <div className="space-y-6">
            {/* Top section: Image grid + stat cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <Card className="overflow-hidden">
                  <CardContent className="p-2">
                    <GameImageGrid games={stats.topGames} />
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard value={stats.totalPlays} label="Plays" icon={Dices} />
                  <StatCard value={stats.hIndex} label="H-Index" icon={TrendingUp} />
                  <StatCard value={stats.gamesPlayed} label="Games" icon={Gamepad2} />
                  <StatCard value={stats.newGamesThisPeriod} label="New" icon={Sparkles} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard value={stats.uniquePlayers} label="Players" icon={Users} />
                  <StatCard value={stats.totalHours} label="Hours" icon={Clock} />
                  <StatCard value={stats.daysWithPlays} label="Days" icon={Calendar} />
                  <StatCard value={`${stats.topMechanics.length}`} label="Mechanics" icon={Hash} />
                </div>

                {/* Streaks & avg duration */}
                {analytics && (
                  <PlayStreakStats
                    longestStreak={analytics.longestStreak}
                    currentStreak={analytics.currentStreak}
                    avgDuration={analytics.avgPlayDuration}
                  />
                )}
              </div>
            </div>

            {/* Charts row 1: Day of Week + Player Count */}
            {analytics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DayOfWeekChart data={analytics.dayOfWeek} />
                <PlayerCountChart data={analytics.playerCounts} />
              </div>
            )}

            {/* Charts row 2: Plays trend */}
            {analytics && (
              <PlaysTrendChart data={analytics.dailyPlays} />
            )}

            {/* Calendar heatmap */}
            {analytics && (
              <PlayCalendarHeatmap data={analytics.calendarHeatmap} />
            )}

            {/* Bottom section: Mechanics + Top Games + Win Rates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Hash className="h-4 w-4 text-primary" />
                    Top Mechanics
                  </h3>
                  <MechanicsList mechanics={stats.topMechanics} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Dices className="h-4 w-4 text-primary" />
                    Most Played
                  </h3>
                  <TopGamesList games={stats.topGames} />
                </CardContent>
              </Card>

              {analytics && analytics.topPlayers.length > 0 && (
                <PlayerWinRateChart data={analytics.topPlayers} />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
