import { useLibraryAnalytics, type TopGame, type RatingDistribution } from "@/hooks/useLibraryAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Gamepad2, 
  Users, 
  Star, 
  Heart, 
  MessageSquare, 
  TrendingUp,
  Trophy,
  BarChart3
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { format, parseISO } from "date-fns";
import { GameImage } from "@/components/games/GameImage";

interface LibraryAnalyticsDashboardProps {
  libraryId: string;
}

export function LibraryAnalyticsDashboard({ libraryId }: LibraryAnalyticsDashboardProps) {
  const {
    summary,
    summaryLoading,
    trends,
    trendsLoading,
    topGames,
    topGamesLoading,
    ratingDistribution,
    ratingDistributionLoading,
  } = useLibraryAnalytics(libraryId);

  const statCards = [
    { label: "Total Games", value: summary?.totalGames || 0, icon: Gamepad2, color: "text-blue-500" },
    { label: "Total Plays", value: summary?.totalPlays || 0, icon: Trophy, color: "text-green-500" },
    { label: "Unique Players", value: summary?.uniquePlayers || 0, icon: Users, color: "text-purple-500" },
    { label: "Avg Rating", value: summary?.averageRating?.toFixed(1) || "—", icon: Star, color: "text-yellow-500" },
    { label: "Wishlist Votes", value: summary?.wishlistVotes || 0, icon: Heart, color: "text-red-500" },
    { label: "Unread Messages", value: summary?.unreadMessages || 0, icon: MessageSquare, color: "text-orange-500" },
  ];

  const ratingColors = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-card/50">
            <CardContent className="p-4">
              {summaryLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex flex-col items-center text-center">
                  <stat.icon className={`h-6 w-6 ${stat.color} mb-2`} />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Play Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Play Trends (Last 30 Days)
            </CardTitle>
            <CardDescription>Number of game sessions logged per day</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(parseISO(val), "MMM d")}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    allowDecimals={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip 
                    labelFormatter={(val) => format(parseISO(val as string), "MMMM d, yyyy")}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="plays" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No play data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Rating Distribution
            </CardTitle>
            <CardDescription>How visitors are rating your games</CardDescription>
          </CardHeader>
          <CardContent>
            {ratingDistributionLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : ratingDistribution.some(r => r.count > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ratingDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="rating" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(val) => `${val}★`}
                  />
                  <YAxis 
                    allowDecimals={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip 
                    labelFormatter={(val) => `${val} Star${val !== 1 ? 's' : ''}`}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {ratingDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={ratingColors[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No ratings yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Games */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Most Played Games
          </CardTitle>
          <CardDescription>Your top 10 games by number of play sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {topGamesLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : topGames.length > 0 ? (
            <div className="space-y-3">
              {topGames.map((game, index) => (
                <TopGameRow key={game.id} game={game} rank={index + 1} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No games have been played yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TopGameRow({ game, rank }: { game: TopGame; rank: number }) {
  const medalColors: Record<number, string> = {
    1: "text-yellow-500",
    2: "text-gray-400",
    3: "text-amber-600",
  };

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className={`text-2xl font-bold w-8 text-center ${medalColors[rank] || "text-muted-foreground"}`}>
        {rank}
      </div>
      <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-muted">
        {game.image_url ? (
          <GameImage 
            imageUrl={game.image_url} 
            alt={game.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{game.title}</div>
        <div className="text-sm text-muted-foreground">
          {game.playCount} play{game.playCount !== 1 ? "s" : ""}
          {game.averageRating && (
            <span className="ml-3">
              ★ {game.averageRating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
