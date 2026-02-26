import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Library, Gamepad2, Star, TrendingUp, BookOpen, MessageSquare, Trophy, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAdminSummary,
  useUserGrowth,
  useLibraryGrowth,
  useEngagementStats,
  useActivityTrend,
  useDAUTrend,
  type TimeRange,
} from "@/hooks/useAdminAnalytics";
import {
  LineChart, Line, AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "all", label: "All Time" },
];

export function PlatformAnalytics() {
  const [range, setRange] = useState<TimeRange>("30d");
  const { data: summary, isLoading: summaryLoading } = useAdminSummary();
  const { data: userGrowth = [], isLoading: userGrowthLoading } = useUserGrowth(range);
  const { data: libraryGrowth = [], isLoading: libraryGrowthLoading } = useLibraryGrowth(range);
  const { data: engagement, isLoading: engagementLoading } = useEngagementStats(range);
  const { data: activityTrend = [] } = useActivityTrend(range);
  const { data: dauTrend = [] } = useDAUTrend(range);

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const stats = [
    { title: "Total Users", value: summary?.totalUsers || 0, icon: Users, color: "text-blue-400", bgColor: "bg-blue-500/20" },
    { title: "Libraries", value: summary?.totalLibraries || 0, icon: Library, color: "text-green-400", bgColor: "bg-green-500/20" },
    { title: "Games", value: summary?.totalGames || 0, icon: Gamepad2, color: "text-purple-400", bgColor: "bg-purple-500/20" },
    { title: "Play Sessions", value: summary?.totalSessions || 0, icon: Trophy, color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
    { title: "Active Libraries", value: summary?.activeLibraries || 0, icon: TrendingUp, color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
    { title: "Premium", value: summary?.premiumLibraries || 0, icon: Star, color: "text-amber-400", bgColor: "bg-amber-500/20" },
    { title: "Clubs", value: summary?.totalClubs || 0, icon: Target, color: "text-cyan-400", bgColor: "bg-cyan-500/20" },
    { title: "Loans", value: summary?.totalLoans || 0, icon: BookOpen, color: "text-orange-400", bgColor: "bg-orange-500/20" },
  ];

  const chartTooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--card-foreground))",
  };

  const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };
  const formatDate = (val: string) => {
    try { return format(parseISO(val), "MMM d"); } catch { return val; }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-wood-medium/20 border-wood-medium/50">
            <CardContent className="p-3 text-center">
              <div className={`inline-flex p-1.5 rounded-lg ${stat.bgColor} mb-1`}>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
              <div className="text-xl font-bold text-cream">{stat.value.toLocaleString()}</div>
              <p className="text-[10px] text-cream/50">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Time Range Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-cream/60 font-medium">Time Range:</span>
        {TIME_RANGES.map((r) => (
          <Button
            key={r.value}
            size="sm"
            variant={range === r.value ? "default" : "outline"}
            className={cn(
              "text-xs h-7",
              range === r.value
                ? "bg-secondary text-secondary-foreground"
                : "border-wood-medium/50 text-cream/70 hover:text-cream hover:bg-wood-medium/40"
            )}
            onClick={() => setRange(r.value)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* Growth Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="User Signups" description="New user registrations" loading={userGrowthLoading}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={tickStyle} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={tickStyle} />
              <Tooltip labelFormatter={(v) => { try { return format(parseISO(v as string), "MMM d, yyyy"); } catch { return v; } }} contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="hsl(210 100% 60%)" fill="hsl(210 100% 60% / 0.2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Library Growth" description="New libraries created" loading={libraryGrowthLoading}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={libraryGrowth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={tickStyle} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={tickStyle} />
              <Tooltip labelFormatter={(v) => { try { return format(parseISO(v as string), "MMM d, yyyy"); } catch { return v; } }} contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="hsl(142 71% 45%)" fill="hsl(142 71% 45% / 0.2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* DAU + Activity Trend */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Daily Active Users" description="Unique users with activity per day">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dauTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={tickStyle} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={tickStyle} />
              <Tooltip labelFormatter={(v) => { try { return format(parseISO(v as string), "MMM d, yyyy"); } catch { return v; } }} contentStyle={chartTooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="hsl(280 70% 60%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Activity Events" description="Total events (actions) per day">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={activityTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={tickStyle} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={tickStyle} />
              <Tooltip labelFormatter={(v) => { try { return format(parseISO(v as string), "MMM d, yyyy"); } catch { return v; } }} contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Engagement Breakdown */}
      <Card className="bg-wood-medium/20 border-wood-medium/50">
        <CardHeader>
          <CardTitle className="text-cream flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-secondary" />
            Content & Engagement
          </CardTitle>
          <CardDescription className="text-cream/60">
            Activity breakdown for the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {engagementLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-secondary" /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {[
                { label: "Games Added", value: engagement?.gamesAdded || 0, color: "text-blue-400" },
                { label: "Sessions Logged", value: engagement?.sessionsLogged || 0, color: "text-green-400" },
                { label: "Ratings", value: engagement?.ratingsSubmitted || 0, color: "text-yellow-400" },
                { label: "Forum Threads", value: engagement?.forumThreads || 0, color: "text-purple-400" },
                { label: "Forum Replies", value: engagement?.forumReplies || 0, color: "text-indigo-400" },
                { label: "Messages", value: engagement?.messagesExchanged || 0, color: "text-cyan-400" },
                { label: "Loans", value: engagement?.loansCreated || 0, color: "text-orange-400" },
              ].map((item) => (
                <div key={item.label} className="text-center p-3 rounded-lg bg-wood-dark/30">
                  <div className={`text-2xl font-bold ${item.color}`}>{item.value.toLocaleString()}</div>
                  <p className="text-[10px] text-cream/50 mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-wood-medium/20 border-wood-medium/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between py-2 border-b border-wood-medium/30">
              <span className="text-cream/70 text-sm">Active Rate</span>
              <span className="text-green-400 font-semibold">
                {summary?.totalLibraries ? Math.round((summary.activeLibraries / summary.totalLibraries) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-wood-medium/30">
              <span className="text-cream/70 text-sm">Premium Conversion</span>
              <span className="text-yellow-400 font-semibold">
                {summary?.totalLibraries ? Math.round((summary.premiumLibraries / summary.totalLibraries) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-cream/70 text-sm">Avg Libraries/User</span>
              <span className="text-cream font-semibold">
                {summary?.totalUsers ? (summary.totalLibraries / summary.totalUsers).toFixed(1) : 0}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-wood-medium/20 border-wood-medium/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between py-2 border-b border-wood-medium/30">
              <span className="text-cream/70 text-sm">Avg Games/Library</span>
              <span className="text-blue-400 font-semibold">
                {summary?.totalLibraries ? (summary.totalGames / summary.totalLibraries).toFixed(1) : 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-wood-medium/30">
              <span className="text-cream/70 text-sm">Avg Sessions/User</span>
              <span className="text-purple-400 font-semibold">
                {summary?.totalUsers ? (summary.totalSessions / summary.totalUsers).toFixed(1) : 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-cream/70 text-sm">Clubs/1K Users</span>
              <span className="text-cyan-400 font-semibold">
                {summary?.totalUsers ? ((summary.totalClubs / summary.totalUsers) * 1000).toFixed(1) : 0}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-wood-medium/20 border-wood-medium/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between py-2 border-b border-wood-medium/30">
              <span className="text-cream/70 text-sm">Loan Rate</span>
              <span className="text-orange-400 font-semibold">
                {summary?.totalGames ? ((summary.totalLoans / summary.totalGames) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-wood-medium/30">
              <span className="text-cream/70 text-sm">Total Games</span>
              <span className="text-cream font-semibold">{(summary?.totalGames || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-cream/70 text-sm">Total Sessions</span>
              <span className="text-cream font-semibold">{(summary?.totalSessions || 0).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChartCard({ title, description, loading, children }: { title: string; description: string; loading?: boolean; children: React.ReactNode }) {
  return (
    <Card className="bg-wood-medium/20 border-wood-medium/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-cream text-sm">{title}</CardTitle>
        <CardDescription className="text-cream/60 text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[220px] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-secondary" /></div>
        ) : children}
      </CardContent>
    </Card>
  );
}
