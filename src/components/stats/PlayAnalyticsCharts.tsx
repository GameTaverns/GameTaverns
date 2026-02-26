import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { format, parseISO, getDay } from "date-fns";
import { Flame, Clock, Trophy } from "lucide-react";
import type {
  DayOfWeekData, DailyPlayData, PlayerCountData,
  PlayerWinData, CalendarHeatmapDay,
} from "@/hooks/playStats/usePlayAnalytics";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(210 100% 60%)",
  "hsl(142 71% 45%)",
  "hsl(280 70% 60%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(190 80% 50%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--card-foreground))",
  fontSize: "12px",
};

const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

// === Day of Week Chart ===
export function DayOfWeekChart({ data }: { data: DayOfWeekData[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">Plays by Day of Week</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
            <XAxis dataKey="shortDay" tick={tickStyle} />
            <YAxis allowDecimals={false} tick={tickStyle} width={30} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// === Plays Trend Chart ===
export function PlaysTrendChart({ data }: { data: DailyPlayData[] }) {
  const formatDate = (val: string) => {
    try { return format(parseISO(val), "MMM d"); } catch { return val; }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">Plays Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={tickStyle} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={tickStyle} width={30} />
            <Tooltip
              labelFormatter={(v) => { try { return format(parseISO(v as string), "MMM d, yyyy"); } catch { return v; } }}
              contentStyle={tooltipStyle}
            />
            <Line type="monotone" dataKey="plays" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// === Player Count Distribution ===
export function PlayerCountChart({ data }: { data: PlayerCountData[] }) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">Player Count Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
            <XAxis dataKey="playerCount" tick={tickStyle} />
            <YAxis allowDecimals={false} tick={tickStyle} width={30} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="sessions" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// === Win Rates ===
export function PlayerWinRateChart({ data }: { data: PlayerWinData[] }) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Player Win Rates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((player) => (
            <div key={player.name} className="flex items-center gap-3">
              <span className="text-sm text-foreground truncate flex-1 min-w-0">{player.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${player.winRate}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-primary w-10 text-right">{player.winRate}%</span>
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {player.wins}W / {player.plays}P
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// === Calendar Heatmap ===
const HEATMAP_COLORS = [
  "hsl(var(--muted) / 0.3)",
  "hsl(var(--primary) / 0.25)",
  "hsl(var(--primary) / 0.5)",
  "hsl(var(--primary) / 0.75)",
  "hsl(var(--primary))",
];

export function PlayCalendarHeatmap({ data }: { data: CalendarHeatmapDay[] }) {
  if (data.length === 0) return null;

  // Group by week (columns) with day-of-week rows
  const weeks: CalendarHeatmapDay[][] = [];
  let currentWeek: CalendarHeatmapDay[] = [];

  // Pad start with empty days
  const firstDate = parseISO(data[0].date);
  const startDow = getDay(firstDate);
  for (let i = 0; i < startDow; i++) {
    currentWeek.push({ date: "", count: -1, level: 0 });
  }

  data.forEach((day) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: "", count: -1, level: 0 });
    }
    weeks.push(currentWeek);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">Play Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex gap-[3px] min-w-fit">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day, di) => (
                  <div
                    key={`${wi}-${di}`}
                    className="w-3 h-3 rounded-[2px] transition-colors"
                    style={{
                      backgroundColor: day.count < 0 ? "transparent" : HEATMAP_COLORS[day.level],
                    }}
                    title={day.count >= 0 ? `${day.date}: ${day.count} plays` : ""}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
            <span>Less</span>
            {HEATMAP_COLORS.map((color, i) => (
              <div key={i} className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: color }} />
            ))}
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// === Streak & Duration Stats ===
export function PlayStreakStats({
  longestStreak,
  currentStreak,
  avgDuration,
}: {
  longestStreak: number;
  currentStreak: number;
  avgDuration: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card>
        <CardContent className="p-3 text-center">
          <Flame className="h-4 w-4 mx-auto mb-1 text-destructive/70" />
          <div className="text-2xl font-bold text-foreground">{currentStreak}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Streak</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Flame className="h-4 w-4 mx-auto mb-1 text-destructive" />
          <div className="text-2xl font-bold text-foreground">{longestStreak}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Best Streak</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Clock className="h-4 w-4 mx-auto mb-1 text-primary" />
          <div className="text-2xl font-bold text-foreground">{avgDuration}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Min/Game</div>
        </CardContent>
      </Card>
    </div>
  );
}
