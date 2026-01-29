import { useAchievements, type Achievement, type AchievementCategory } from "@/hooks/useAchievements";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Trophy, 
  Gamepad2, 
  Users, 
  Compass, 
  PenTool, 
  BookOpen,
  Lock,
  Star
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const CATEGORY_CONFIG: Record<AchievementCategory, { label: string; icon: React.ReactNode; color: string }> = {
  collector: { label: "Collector", icon: <Gamepad2 className="h-4 w-4" />, color: "text-blue-500" },
  player: { label: "Player", icon: <Trophy className="h-4 w-4" />, color: "text-green-500" },
  social: { label: "Social", icon: <Users className="h-4 w-4" />, color: "text-purple-500" },
  explorer: { label: "Explorer", icon: <Compass className="h-4 w-4" />, color: "text-orange-500" },
  contributor: { label: "Contributor", icon: <PenTool className="h-4 w-4" />, color: "text-pink-500" },
  lender: { label: "Lender", icon: <BookOpen className="h-4 w-4" />, color: "text-teal-500" },
};

interface AchievementCardProps {
  achievement: Achievement;
  isEarned: boolean;
  earnedAt?: string;
  progress?: number;
  tierName: string;
  tierColor: string;
}

function AchievementCard({ achievement, isEarned, earnedAt, progress = 0, tierName, tierColor }: AchievementCardProps) {
  const percentComplete = Math.min(100, (progress / achievement.requirement_value) * 100);
  const categoryConfig = CATEGORY_CONFIG[achievement.category];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={`transition-all ${isEarned ? "" : "opacity-60 grayscale"}`}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`text-3xl ${isEarned ? "" : "opacity-50"}`}>
                  {achievement.icon || "🏆"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm truncate">{achievement.name}</h4>
                    {isEarned ? (
                      <Badge className={tierColor} variant="secondary">
                        {tierName}
                      </Badge>
                    ) : (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {achievement.description}
                  </p>

                  {!isEarned && progress > 0 && (
                    <div className="mt-2">
                      <Progress value={percentComplete} className="h-1" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {progress} / {achievement.requirement_value}
                      </p>
                    </div>
                  )}

                  {isEarned && earnedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Earned {formatDistanceToNow(new Date(earnedAt), { addSuffix: true })}
                    </p>
                  )}
                </div>

                {/* Points */}
                <div className="text-right">
                  <span className={`text-sm font-bold ${isEarned ? "text-primary" : "text-muted-foreground"}`}>
                    +{achievement.points}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p>{achievement.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {categoryConfig.label} • {tierName} • {achievement.points} points
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AchievementsDisplay() {
  const {
    allAchievements,
    userAchievements,
    totalPoints,
    achievementsByCategory,
    recentAchievements,
    isLoading,
    isEarned,
    getProgress,
    TIER_NAMES,
    TIER_COLORS,
  } = useAchievements();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const earnedCount = userAchievements.length;
  const totalCount = allAchievements.filter((a) => !a.is_secret).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            Achievements
          </h2>
          <p className="text-muted-foreground">
            {earnedCount} of {totalCount} unlocked
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-primary">{totalPoints}</div>
          <p className="text-sm text-muted-foreground">Total Points</p>
        </div>
      </div>

      {/* Recent Achievements */}
      {recentAchievements.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Star className="h-4 w-4" />
            Recently Earned
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {recentAchievements.map((ua) => (
              <Badge
                key={ua.id}
                variant="secondary"
                className={`${TIER_COLORS[ua.achievement?.tier || 1]} gap-1 whitespace-nowrap`}
              >
                <span>{ua.achievement?.icon || "🏆"}</span>
                {ua.achievement?.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <TabsTrigger key={key} value={key} className="gap-1">
              {config.icon}
              {config.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allAchievements
              .filter((a) => !a.is_secret || isEarned(a.id))
              .map((achievement) => {
                const ua = userAchievements.find((u) => u.achievement_id === achievement.id);
                return (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    isEarned={!!ua}
                    earnedAt={ua?.earned_at}
                    progress={ua?.progress || 0}
                    tierName={TIER_NAMES[achievement.tier]}
                    tierColor={TIER_COLORS[achievement.tier]}
                  />
                );
              })}
          </div>
        </TabsContent>

        {Object.entries(achievementsByCategory).map(([category, achievements]) => (
          <TabsContent key={category} value={category}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements
                .filter((a) => !a.is_secret || isEarned(a.id))
                .map((achievement) => {
                  const ua = userAchievements.find((u) => u.achievement_id === achievement.id);
                  return (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      isEarned={!!ua}
                      earnedAt={ua?.earned_at}
                      progress={ua?.progress || 0}
                      tierName={TIER_NAMES[achievement.tier]}
                      tierColor={TIER_COLORS[achievement.tier]}
                    />
                  );
                })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
