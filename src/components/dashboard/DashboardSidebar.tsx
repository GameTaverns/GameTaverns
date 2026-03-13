import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useMyLibraries } from "@/hooks/useLibrary";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Calendar, TrendingUp, Flame, Newspaper, Gamepad2, BookOpen } from "lucide-react";
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

function HotGamesWidget() {
  const { t } = useTranslation();

  const { data: hotGames = [] } = useQuery({
    queryKey: ["dashboard-hot-games"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("game_hotness")
        .select("game_id, title, image_url, hotness_score, slug")
        .order("hotness_score", { ascending: false })
        .limit(5);

      if (error) return [];
      return data || [];
    },
    staleTime: 300000, // 5 min
  });

  if (hotGames.length === 0) {
    return (
      <WidgetCard title={t('dashboard.hotGames', 'Hot Games')} icon={Flame}>
        <p className="text-xs text-muted-foreground italic">
          {t('dashboard.noHotGames', 'No trending games right now')}
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title={t('dashboard.hotGames', 'Hot Games')} icon={Flame}>
      <div className="space-y-2">
        {hotGames.map((game: any, idx: number) => (
          <Link key={game.game_id} to={`/catalog`} className="flex items-center gap-2 group">
            <span className="text-xs font-bold text-muted-foreground w-4">{idx + 1}</span>
            {game.thumbnail_url && (
              <img src={game.thumbnail_url} alt="" className="h-7 w-7 rounded object-cover" />
            )}
            <span className="text-sm text-foreground group-hover:text-primary transition-colors truncate">
              {game.title}
            </span>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}

function LatestNewsWidget() {
  const { t } = useTranslation();

  const { data: articles = [] } = useQuery({
    queryKey: ["dashboard-latest-news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("id, title, slug, source_name, published_at, image_url")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(4);

      if (error) return [];
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
      <UpcomingEventsWidget />
      <LatestNewsWidget />
      <HotGamesWidget />
    </div>
  );
}
