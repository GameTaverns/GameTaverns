import { useState } from "react";
import { useAchievements, type Achievement, type AchievementCategory } from "@/hooks/useAchievements";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
  Star,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORY_CONFIG: Record<AchievementCategory, { label: string; icon: React.ReactNode; color: string }> = {
  collector: { label: "Collector", icon: <Gamepad2 className="h-5 w-5" />, color: "text-blue-500" },
  player: { label: "Player", icon: <Trophy className="h-5 w-5" />, color: "text-green-500" },
  social: { label: "Social", icon: <Users className="h-5 w-5" />, color: "text-purple-500" },
  explorer: { label: "Explorer", icon: <Compass className="h-5 w-5" />, color: "text-orange-500" },
  contributor: { label: "Contributor", icon: <PenTool className="h-5 w-5" />, color: "text-pink-500" },
  lender: { label: "Lender", icon: <BookOpen className="h-5 w-5" />, color: "text-teal-500" },
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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={`transition-all ${isEarned ? "border-primary/30 bg-card" : "opacity-50 bg-muted/30"}`}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className={`text-2xl ${isEarned ? "" : "grayscale"}`}>
                  {achievement.icon || "🏆"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-semibold text-sm truncate ${isEarned ? "text-foreground" : "text-muted-foreground"}`}>
                      {achievement.name}
                    </h4>
                    {isEarned ? (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  
                  <p className={`text-xs line-clamp-1 ${isEarned ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                    {achievement.description}
                  </p>

                  {!isEarned && progress > 0 && (
                    <div className="mt-1.5">
                      <Progress value={percentComplete} className="h-1" />
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {progress} / {achievement.requirement_value}
                      </p>
                    </div>
                  )}

                  {isEarned && earnedAt && (
                    <p className="text-xs text-primary/70 mt-0.5">
                      Earned {formatDistanceToNow(new Date(earnedAt), { addSuffix: true })}
                    </p>
                  )}
                </div>

                {/* Points & Tier */}
                <div className="text-right shrink-0">
                  <Badge variant="secondary" className={`${isEarned ? tierColor : "bg-muted text-muted-foreground"} text-xs`}>
                    {tierName}
                  </Badge>
                  <p className={`text-xs mt-1 ${isEarned ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    +{achievement.points} pts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{achievement.name}</p>
          <p className="text-sm text-muted-foreground">{achievement.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {tierName} • {achievement.points} points
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface AchievementsDisplayProps {
  compact?: boolean;
}

export function AchievementsDisplay({ compact = false }: AchievementsDisplayProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  
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

  const handleSyncAchievements = async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to sync achievements");
        return;
      }

      const response = await supabase.functions.invoke("sync-achievements");
      
      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      
      if (result.newAchievements > 0) {
        toast.success(`🎉 Unlocked ${result.newAchievements} achievement${result.newAchievements > 1 ? 's' : ''}!`, {
          description: result.awarded.join(", "),
        });
        // Refresh achievements data
        queryClient.invalidateQueries({ queryKey: ["achievements"] });
        queryClient.invalidateQueries({ queryKey: ["user-achievements"] });
      } else {
        toast.info("Achievements synced - no new unlocks yet!");
      }
    } catch (error) {
      console.error("Failed to sync achievements:", error);
      toast.error("Failed to sync achievements");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  const earnedCount = userAchievements.length;
  const totalCount = allAchievements.filter((a) => !a.is_secret).length;

  // Order categories for display
  const categoryOrder: AchievementCategory[] = ['collector', 'player', 'lender', 'social', 'explorer', 'contributor'];

  // Compact mode - show summary only
  if (compact) {
    return (
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">
                {earnedCount} / {totalCount} unlocked
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">{totalPoints}</span>
            <span className="text-xs text-muted-foreground">pts</span>
          </div>
        </div>

        {/* Recent Badges */}
        {recentAchievements.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {recentAchievements.slice(0, 4).map((ua) => (
              <Badge
                key={ua.id}
                variant="secondary"
                className={`${TIER_COLORS[ua.achievement?.tier || 1]} gap-1 text-xs`}
              >
                <span>{ua.achievement?.icon || "🏆"}</span>
                {ua.achievement?.name}
              </Badge>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncAchievements}
          disabled={isSyncing}
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync Progress"}
        </Button>
      </div>
    );
  }

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
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAchievements}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync Progress"}
          </Button>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">{totalPoints}</div>
            <p className="text-sm text-muted-foreground">Total Points</p>
          </div>
        </div>
      </div>

      {/* Recent Achievements */}
      {recentAchievements.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Star className="h-4 w-4" />
            Recently Earned
          </h3>
          <div className="flex gap-2 flex-wrap">
            {recentAchievements.map((ua) => (
              <Badge
                key={ua.id}
                variant="secondary"
                className={`${TIER_COLORS[ua.achievement?.tier || 1]} gap-1`}
              >
                <span>{ua.achievement?.icon || "🏆"}</span>
                {ua.achievement?.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* All Achievements by Category */}
      <div className="space-y-8">
        {categoryOrder.map((category) => {
          const achievements = achievementsByCategory[category];
          if (!achievements || achievements.length === 0) return null;

          const config = CATEGORY_CONFIG[category];
          const earnedInCategory = achievements.filter((a) => isEarned(a.id)).length;

          return (
            <div key={category} className="space-y-3">
              {/* Category Header */}
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <span className={config.color}>{config.icon}</span>
                <h3 className="font-display font-semibold text-lg">{config.label}</h3>
                <Badge variant="outline" className="ml-auto">
                  {earnedInCategory} / {achievements.length}
                </Badge>
              </div>

              {/* Achievement List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}