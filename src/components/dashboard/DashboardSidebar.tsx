import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useMyLibraries } from "@/hooks/useLibrary";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Calendar, TrendingUp, Newspaper, Gamepad2, BookOpen, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

function WidgetCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="card-handcrafted p-4">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground mb-3">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function MyStatsWidget() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: library } = useMyLibrary();
  const { data: libraries = [] } = useMyLibraries();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", library?.id],
    queryFn: async () => {
      if (!library?.id) return { games: 0, sessions: 0, expansions: 0 };

      const { count } = await supabase
        .from("games")
        .select("id", { count: "exact", head: true })
        .eq("library_id", library.id);

      return {
        games: count ?? 0,
      };
    },
    enabled: !!library?.id,
    staleTime: 60000,
  });

  return (
    <WidgetCard title={t('dashboard.myStats', 'My Stats')} icon={TrendingUp}>
      <div className="grid grid-cols-2 gap-2">
        <StatBlock icon={Gamepad2} label={t('dashboard.games', 'Games')} value={stats?.games ?? 0} />
        
        <StatBlock icon={BookOpen} label={t('dashboard.libraries', 'Libraries')} value={libraries.length} />
      </div>
    </WidgetCard>
  );
}

function StatBlock({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <div>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function FollowersWidget() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: followers = [] } = useQuery({
    queryKey: ["dashboard-followers", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get users who follow me
      const { data: followData, error } = await (supabase as any)
        .from("user_follows")
        .select("follower_id, created_at")
        .eq("following_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error || !followData || followData.length === 0) return [];

      const followerIds = followData.map((f: any) => f.follower_id);

      // Get profiles for these followers
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", followerIds);

      return (profiles || []).map((p: any) => ({
        ...p,
        followed_at: followData.find((f: any) => f.follower_id === p.user_id)?.created_at,
      }));
    },
    enabled: !!user?.id,
    staleTime: 120000,
  });

  const { data: counts } = useQuery({
    queryKey: ["dashboard-follow-counts", user?.id],
    queryFn: async () => {
      if (!user?.id) return { followers: 0, following: 0 };

      const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
        (supabase as any).from("user_follows").select("id", { count: "exact", head: true }).eq("following_id", user.id),
        (supabase as any).from("user_follows").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
      ]);

      return { followers: followerCount ?? 0, following: followingCount ?? 0 };
    },
    enabled: !!user?.id,
    staleTime: 120000,
  });

  return (
    <WidgetCard title={t('dashboard.followers', 'Followers')} icon={Users}>
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{counts?.followers ?? 0}</strong> followers</span>
        <span><strong className="text-foreground">{counts?.following ?? 0}</strong> following</span>
      </div>
      {followers.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {t('dashboard.noFollowers', 'No followers yet')}
        </p>
      ) : (
        <div className="space-y-2">
          {followers.map((follower: any) => (
            <Link
              key={follower.user_id}
              to={`/u/${follower.username}`}
              className="flex items-center gap-2.5 group"
            >
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {follower.avatar_url ? (
                  <img src={follower.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-foreground group-hover:text-primary transition-colors truncate">
                  {follower.display_name || follower.username || 'User'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Link to="/discover" className="text-xs text-primary hover:underline mt-3 inline-block">
        {t('dashboard.discoverPeople', 'Discover people →')}
      </Link>
    </WidgetCard>
  );
}

function UpcomingEventsWidget() {
  const { t } = useTranslation();

  const { data: events = [] } = useQuery({
    queryKey: ["dashboard-upcoming-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_events")
        .select("id, title, event_date, library_id")
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(4);

      if (error) return [];
      return data || [];
    },
    staleTime: 60000,
  });

  if (events.length === 0) {
    return (
      <WidgetCard title={t('dashboard.upcomingEvents', 'Upcoming Events')} icon={Calendar}>
        <p className="text-xs text-muted-foreground italic">
          {t('dashboard.noUpcomingEvents', 'No upcoming events')}
        </p>
        <Link to="/events" className="text-xs text-primary hover:underline mt-1 inline-block">
          {t('dashboard.browseEvents', 'Browse events →')}
        </Link>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title={t('dashboard.upcomingEvents', 'Upcoming Events')} icon={Calendar}>
      <div className="space-y-2">
        {events.map((event: any) => (
          <Link key={event.id} to={`/events`} className="block group">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground group-hover:text-primary transition-colors truncate">
                {event.title}
              </p>
              <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                {formatDistanceToNow(new Date(event.event_date), { addSuffix: true })}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}


function LatestNewsWidget() {
  const { t } = useTranslation();

  const { data: articles = [], error: newsError } = useQuery({
    queryKey: ["dashboard-latest-news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("id, title, slug, published_at, image_url, source:news_sources(name)")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(4);

      if (error) {
        console.error("[LatestNewsWidget] Query error:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 300000, // 5 min
  });

  if (articles.length === 0) {
    return (
      <WidgetCard title={t('dashboard.latestNews', 'Latest News')} icon={Newspaper}>
        <p className="text-xs text-muted-foreground italic">
          {t('dashboard.noNews', 'No news articles yet')}
        </p>
        <Link to="/news" className="text-xs text-primary hover:underline mt-1 inline-block">
          {t('dashboard.browseNews', 'Browse news →')}
        </Link>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title={t('dashboard.latestNews', 'Latest News')} icon={Newspaper}>
      <div className="space-y-2.5">
        {articles.map((article: any) => (
          <Link key={article.id} to={`/news/${article.slug}`} className="flex items-start gap-2.5 group">
            {article.image_url && (
              <img
                src={article.image_url}
                alt=""
                className="h-10 w-14 rounded object-cover shrink-0 mt-0.5"
                loading="lazy"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                {article.title}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {article.source_name}
                {article.published_at && (
                  <> · {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}</>
                )}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <Link to="/news" className="text-xs text-primary hover:underline mt-3 inline-block">
        {t('dashboard.viewAllNews', 'View all news →')}
      </Link>
    </WidgetCard>
  );
}

export function DashboardSidebar() {
  return (
    <div className="space-y-4">
      <MyStatsWidget />
      <FollowersWidget />
      <UpcomingEventsWidget />
      <LatestNewsWidget />
    </div>
  );
}
