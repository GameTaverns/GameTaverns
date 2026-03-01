import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Eye, MousePointerClick, UserX, TrendingUp, BarChart3 } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from "recharts";

type TimeRange = "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "all", label: "All Time" },
];

const EVENT_COLORS: Record<string, string> = {
  sent: "hsl(var(--primary))",
  opened: "hsl(var(--secondary))",
  clicked: "#556b2f",
  unsubscribed: "hsl(var(--destructive))",
};

function getStartDate(range: TimeRange): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return startOfDay(subDays(new Date(), days));
}

function useEmailEvents(range: TimeRange) {
  return useQuery({
    queryKey: ["admin-email-events", range],
    queryFn: async () => {
      const startDate = getStartDate(range);
      let query = supabase
        .from("reengagement_email_events")
        .select("event_type, created_at, user_id")
        .order("created_at", { ascending: true });

      if (startDate) query = query.gte("created_at", startDate.toISOString());

      const { data, error } = await query.limit(5000);
      if (error) throw error;
      return data || [];
    },
  });
}

export function EmailEngagementAnalytics() {
  const [range, setRange] = useState<TimeRange>("30d");
  const { data: events, isLoading } = useEmailEvents(range);

  const summary = useMemo(() => {
    if (!events) return { sent: 0, opened: 0, clicked: 0, unsubscribed: 0 };
    const counts = { sent: 0, opened: 0, clicked: 0, unsubscribed: 0 };
    events.forEach((e: any) => {
      if (e.event_type in counts) counts[e.event_type as keyof typeof counts]++;
    });
    return counts;
  }, [events]);

  const openRate = summary.sent > 0 ? ((summary.opened / summary.sent) * 100).toFixed(1) : "0";
  const clickRate = summary.opened > 0 ? ((summary.clicked / summary.opened) * 100).toFixed(1) : "0";
  const unsubRate = summary.sent > 0 ? ((summary.unsubscribed / summary.sent) * 100).toFixed(1) : "0";

  // Daily trend data
  const dailyTrend = useMemo(() => {
    if (!events) return [];
    const byDate = new Map<string, { sent: number; opened: number; clicked: number; unsubscribed: number }>();

    if (range !== "all") {
      const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      for (let i = days - 1; i >= 0; i--) {
        byDate.set(format(subDays(new Date(), i), "yyyy-MM-dd"), { sent: 0, opened: 0, clicked: 0, unsubscribed: 0 });
      }
    }

    events.forEach((e: any) => {
      const date = format(new Date(e.created_at), "yyyy-MM-dd");
      if (!byDate.has(date)) byDate.set(date, { sent: 0, opened: 0, clicked: 0, unsubscribed: 0 });
      const entry = byDate.get(date)!;
      if (e.event_type in entry) entry[e.event_type as keyof typeof entry]++;
    });

    return Array.from(byDate.entries()).map(([date, counts]) => ({ date, ...counts }));
  }, [events, range]);

  // Funnel data for pie chart
  const funnelData = useMemo(() => [
    { name: "Sent (not opened)", value: Math.max(0, summary.sent - summary.opened), color: EVENT_COLORS.sent },
    { name: "Opened (not clicked)", value: Math.max(0, summary.opened - summary.clicked), color: EVENT_COLORS.opened },
    { name: "Clicked", value: summary.clicked, color: EVENT_COLORS.clicked },
    { name: "Unsubscribed", value: summary.unsubscribed, color: EVENT_COLORS.unsubscribed },
  ].filter(d => d.value > 0), [summary]);

  // Unique users
  const uniqueUsers = useMemo(() => {
    if (!events) return { sent: 0, opened: 0, clicked: 0 };
    const sets = { sent: new Set<string>(), opened: new Set<string>(), clicked: new Set<string>() };
    events.forEach((e: any) => {
      if (e.event_type in sets) sets[e.event_type as keyof typeof sets].add(e.user_id);
    });
    return { sent: sets.sent.size, opened: sets.opened.size, clicked: sets.clicked.size };
  }, [events]);

  if (isLoading) {
    return <div className="text-muted-foreground text-sm p-4">Loading email analytics…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-secondary" />
          <h3 className="font-display text-lg font-bold text-cream">Re-engagement Email Analytics</h3>
        </div>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant={range === opt.value ? "default" : "outline"}
              onClick={() => setRange(opt.value)}
              className="text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-wood-medium/20 border-wood-medium/40">
          <CardContent className="p-4 text-center">
            <Mail className="h-5 w-5 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold text-cream">{summary.sent}</div>
            <div className="text-xs text-cream/60">Emails Sent</div>
            <div className="text-[10px] text-cream/40 mt-1">{uniqueUsers.sent} unique users</div>
          </CardContent>
        </Card>
        <Card className="bg-wood-medium/20 border-wood-medium/40">
          <CardContent className="p-4 text-center">
            <Eye className="h-5 w-5 text-secondary mx-auto mb-1" />
            <div className="text-2xl font-bold text-cream">{summary.opened}</div>
            <div className="text-xs text-cream/60">Opens</div>
            <Badge variant="outline" className="mt-1 text-[10px] border-secondary/50 text-secondary">{openRate}% rate</Badge>
          </CardContent>
        </Card>
        <Card className="bg-wood-medium/20 border-wood-medium/40">
          <CardContent className="p-4 text-center">
            <MousePointerClick className="h-5 w-5 mx-auto mb-1" style={{ color: "#556b2f" }} />
            <div className="text-2xl font-bold text-cream">{summary.clicked}</div>
            <div className="text-xs text-cream/60">Clicks</div>
            <Badge variant="outline" className="mt-1 text-[10px] border-secondary/50 text-secondary">{clickRate}% CTR</Badge>
          </CardContent>
        </Card>
        <Card className="bg-wood-medium/20 border-wood-medium/40">
          <CardContent className="p-4 text-center">
            <UserX className="h-5 w-5 text-destructive mx-auto mb-1" />
            <div className="text-2xl font-bold text-cream">{summary.unsubscribed}</div>
            <div className="text-xs text-cream/60">Unsubscribes</div>
            <Badge variant="outline" className="mt-1 text-[10px] border-destructive/50 text-destructive">{unsubRate}%</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily trend */}
        <Card className="bg-wood-medium/20 border-wood-medium/40 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-cream flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-secondary" />
              Daily Email Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                    tickFormatter={(v) => format(new Date(v), "MMM d")}
                  />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#3d2b1f", border: "1px solid #5c4a3a", borderRadius: 8, color: "#f5eed9" }}
                    labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sent" name="Sent" fill={EVENT_COLORS.sent} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="opened" name="Opened" fill={EVENT_COLORS.opened} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="clicked" name="Clicked" fill={EVENT_COLORS.clicked} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="unsubscribed" name="Unsub" fill={EVENT_COLORS.unsubscribed} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-cream/40 text-sm text-center py-12">No email data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Funnel pie */}
        <Card className="bg-wood-medium/20 border-wood-medium/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-cream flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-secondary" />
              Engagement Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={funnelData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {funnelData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#3d2b1f", border: "1px solid #5c4a3a", borderRadius: 8, color: "#f5eed9" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-cream/40 text-sm text-center py-12">No data</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
