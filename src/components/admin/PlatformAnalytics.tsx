import { useQuery } from "@tanstack/react-query";
import { supabase, apiClient, isSelfHostedMode } from "@/integrations/backend/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Library, Gamepad2, Star, TrendingUp } from "lucide-react";

interface AnalyticsData {
  totalUsers: number;
  totalLibraries: number;
  activeLibraries: number;
  premiumLibraries: number;
  usersThisWeek: number;
  librariesThisWeek: number;
}

export function PlatformAnalytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async (): Promise<AnalyticsData> => {
      // Self-hosted mode: use Express API
      if (isSelfHostedMode()) {
        return apiClient.get<AnalyticsData>('/admin/analytics');
      }

      // Cloud mode: query Supabase directly
      // Get user counts
      const { count: totalUsers } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true });

      // Get users created in last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: usersThisWeek } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekAgo.toISOString());

      // Get library counts
      const { count: totalLibraries } = await supabase
        .from("libraries")
        .select("*", { count: "exact", head: true });

      const { count: activeLibraries } = await supabase
        .from("libraries")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      const { count: premiumLibraries } = await supabase
        .from("libraries")
        .select("*", { count: "exact", head: true })
        .eq("is_premium", true);

      const { count: librariesThisWeek } = await supabase
        .from("libraries")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekAgo.toISOString());

      return {
        totalUsers: totalUsers || 0,
        totalLibraries: totalLibraries || 0,
        activeLibraries: activeLibraries || 0,
        premiumLibraries: premiumLibraries || 0,
        usersThisWeek: usersThisWeek || 0,
        librariesThisWeek: librariesThisWeek || 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const stats = [
    {
      title: "Total Users",
      value: analytics?.totalUsers || 0,
      icon: Users,
      description: `+${analytics?.usersThisWeek || 0} this week`,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
    },
    {
      title: "Total Libraries",
      value: analytics?.totalLibraries || 0,
      icon: Library,
      description: `+${analytics?.librariesThisWeek || 0} this week`,
      color: "text-green-400",
      bgColor: "bg-green-500/20",
    },
    {
      title: "Active Libraries",
      value: analytics?.activeLibraries || 0,
      icon: TrendingUp,
      description: `${analytics?.totalLibraries ? Math.round((analytics.activeLibraries / analytics.totalLibraries) * 100) : 0}% of total`,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
    },
    {
      title: "Premium Libraries",
      value: analytics?.premiumLibraries || 0,
      icon: Star,
      description: `${analytics?.totalLibraries ? Math.round((analytics.premiumLibraries / analytics.totalLibraries) * 100) : 0}% conversion`,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-wood-medium/20 border-wood-medium/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-cream/70">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-cream">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-cream/50 mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-wood-medium/20 border-wood-medium/50">
          <CardHeader>
            <CardTitle className="text-cream">Growth Overview</CardTitle>
            <CardDescription className="text-cream/60">
              Platform growth metrics for the past week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-cream/70">New Users</span>
                <span className="text-cream font-semibold">+{analytics?.usersThisWeek || 0}</span>
              </div>
              <div className="w-full bg-wood-dark/50 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((analytics?.usersThisWeek || 0) * 10, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-cream/70">New Libraries</span>
                <span className="text-cream font-semibold">+{analytics?.librariesThisWeek || 0}</span>
              </div>
              <div className="w-full bg-wood-dark/50 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((analytics?.librariesThisWeek || 0) * 10, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-wood-medium/20 border-wood-medium/50">
          <CardHeader>
            <CardTitle className="text-cream">Quick Stats</CardTitle>
            <CardDescription className="text-cream/60">
              Platform health indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-wood-medium/30">
                <span className="text-cream/70">Active Rate</span>
                <span className="text-green-400 font-semibold">
                  {analytics?.totalLibraries
                    ? Math.round((analytics.activeLibraries / analytics.totalLibraries) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-wood-medium/30">
                <span className="text-cream/70">Premium Conversion</span>
                <span className="text-yellow-400 font-semibold">
                  {analytics?.totalLibraries
                    ? Math.round((analytics.premiumLibraries / analytics.totalLibraries) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-cream/70">Avg Libraries/User</span>
                <span className="text-cream font-semibold">
                  {analytics?.totalUsers
                    ? (analytics.totalLibraries / analytics.totalUsers).toFixed(1)
                    : 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
