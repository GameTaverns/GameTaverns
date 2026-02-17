import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Trophy, Gamepad2, Dices, BookOpen, Users, Calendar, Star, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getPlatformUrl } from "@/hooks/useTenantUrl";
import {
  usePublicProfile,
  usePublicProfileCommunities,
  usePublicProfileAchievements,
  useFollowCounts,
  useFeaturedAchievement,
} from "@/hooks/usePublicProfile";
import { useUserActivity } from "@/hooks/useActivityFeed";
import { ActivityFeedItem } from "@/components/social/ActivityFeedItem";
import { FeaturedBadge } from "@/components/achievements/FeaturedBadge";
import { FollowButton } from "@/components/social/FollowButton";
import { supabase } from "@/integrations/backend/client";
import logoImage from "@/assets/logo.png";
import { format } from "date-fns";

const TIER_COLORS: Record<number, string> = {
  1: "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
  2: "text-slate-500 bg-slate-100 dark:text-slate-300 dark:bg-slate-700/30",
  3: "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30",
  4: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30",
};

const TIER_NAMES: Record<number, string> = {
  1: "Bronze",
  2: "Silver",
  3: "Gold",
  4: "Platinum",
};

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const { data: profile, isLoading, error } = usePublicProfile(username);
  const { data: communities } = usePublicProfileCommunities(profile?.user_id);
  const { data: achievements } = usePublicProfileAchievements(profile?.user_id);
  const { data: followCounts } = useFollowCounts(profile?.user_id);
  const { data: featuredAchievement } = useFeaturedAchievement(profile?.featured_achievement_id);
  const { data: activityEvents } = useUserActivity(profile?.user_id);

  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id));
  }, []);

  if (isLoading) return <ProfileSkeleton />;

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark">
        <ProfileHeader />
        <main className="container mx-auto px-4 py-16 text-center">
          <Dices className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-display text-3xl font-bold text-cream mb-2">Adventurer Not Found</h1>
          <p className="text-muted-foreground mb-6">
            No tavern-goer with that name could be found.
          </p>
          <Link to={getPlatformUrl("/directory")}>
            <Button variant="outline" className="border-wood-medium/50 text-cream hover:bg-wood-medium/30">
              Browse Libraries
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  const initials = (profile.display_name || profile.username || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark">
      <ProfileHeader />

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Profile Card */}
        <Card className="bg-card/90 backdrop-blur-sm border-border overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/10" />
          <CardContent className="relative pt-0 pb-6 px-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-12">
              <Avatar className="h-24 w-24 border-4 border-card shadow-lg">
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.display_name || profile.username} />
                <AvatarFallback className="text-2xl font-display bg-primary/20 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0 pt-2">
                <h1 className="font-display text-2xl font-bold text-foreground truncate flex items-center gap-2">
                  {profile.display_name || profile.username}
                  <FeaturedBadge achievement={featuredAchievement ?? null} size="md" />
                </h1>
                <p className="text-muted-foreground text-sm">@{profile.username}</p>
                {profile.user_id && (
                  <FollowButton currentUserId={currentUserId} targetUserId={profile.user_id} />
                )}
              </div>

              <div className="flex gap-6 text-center text-sm">
                <div>
                  <div className="font-bold text-foreground">{followCounts?.followers ?? 0}</div>
                  <div className="text-muted-foreground text-xs">Followers</div>
                </div>
                <div>
                  <div className="font-bold text-foreground">{followCounts?.following ?? 0}</div>
                  <div className="text-muted-foreground text-xs">Following</div>
                </div>
              </div>
            </div>

            {profile.bio && (
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {profile.bio}
              </p>
            )}

            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Member since {format(new Date(profile.member_since), "MMMM yyyy")}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Gamepad2} label="Games" value={profile.games_owned} />
          <StatCard icon={BookOpen} label="Expansions" value={profile.expansions_owned} />
          <StatCard icon={Dices} label="Sessions" value={profile.sessions_logged} />
          <StatCard icon={Trophy} label="Achievements" value={profile.achievements_earned} />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Achievements */}
          <Card className="bg-card/90 backdrop-blur-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Recent Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!achievements || achievements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No achievements earned yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {achievements.slice(0, 8).map((ua: any) => (
                    <div
                      key={ua.id}
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
                    >
                      <span className="text-lg">{ua.achievement?.icon || "🏆"}</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate text-foreground text-xs">
                          {ua.achievement?.name || "Achievement"}
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1 py-0 ${TIER_COLORS[ua.achievement?.tier || 1] || ""}`}
                        >
                          {TIER_NAMES[ua.achievement?.tier || 1]}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {achievements && achievements.length > 0 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 inline mr-1" />
                  {profile.achievement_points} total points
                </div>
              )}
            </CardContent>
          </Card>

          {/* Communities */}
          <Card className="bg-card/90 backdrop-blur-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Communities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!communities || communities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not a member of any public communities.</p>
              ) : (
                <div className="space-y-2">
                  {communities.map((c) => (
                    <Link
                      key={c.id}
                      to={`//${c.slug}.${window.location.host}`}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                        {c.role}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card className="bg-card/90 backdrop-blur-sm border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!activityEvents || activityEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activityEvents.map((event) => (
                  <ActivityFeedItem key={event.id} event={event} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ProfileHeader() {
  return (
    <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoImage} alt="GameTaverns" className="h-10 w-auto" />
          <span className="font-display text-2xl font-bold text-cream">GameTaverns</span>
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <a href={getPlatformUrl("/dashboard")}>
            <Button variant="outline" className="gap-2 border-wood-medium/50 text-cream hover:bg-wood-medium/30">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="bg-card/90 backdrop-blur-sm border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-xl font-bold text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark">
      <ProfileHeader />
      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Card className="bg-card/90 backdrop-blur-sm border-border">
          <div className="h-24 bg-muted" />
          <CardContent className="pt-0 pb-6 px-6">
            <div className="flex items-end gap-4 -mt-12">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="space-y-2 pt-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card/90">
              <CardContent className="p-4">
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
