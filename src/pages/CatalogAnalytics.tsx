import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Dices, Star, TrendingUp, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";


interface CatalogEntry {
  catalog_id: string;
  title: string;
  slug: string | null;
  image_url: string | null;
  bgg_id: string | null;
  library_count: number;
  total_plays: number;
  weight: number | null;
  min_players: number | null;
  max_players: number | null;
}

interface RatedEntry {
  catalog_id: string;
  average_rating: number;
  rating_count: number;
  title?: string;
  slug?: string | null;
  image_url?: string | null;
}

function useTopByOwnership() {
  return useQuery({
    queryKey: ["catalog-top-ownership"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_popularity")
        .select("*")
        .gt("library_count", 0)
        .order("library_count", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as CatalogEntry[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

function useTopByPlays() {
  return useQuery({
    queryKey: ["catalog-top-plays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_popularity")
        .select("*")
        .gt("total_plays", 0)
        .order("total_plays", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as CatalogEntry[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

function useTopByRating() {
  return useQuery({
    queryKey: ["catalog-top-ratings"],
    queryFn: async () => {
      const { data: ratings, error } = await supabase
        .from("catalog_ratings_summary")
        .select("catalog_id, average_rating, rating_count")
        .gte("rating_count", 2)
        .order("average_rating", { ascending: false })
        .limit(50);
      if (error) throw error;

      if (!ratings || ratings.length === 0) return [] as RatedEntry[];

      // Fetch catalog details for these IDs
      const ids = ratings.map((r) => r.catalog_id);
      const { data: catalogData } = await supabase
        .from("game_catalog")
        .select("id, title, slug, image_url")
        .in("id", ids);

      const catalogMap = new Map(
        (catalogData || []).map((c) => [c.id, c])
      );

      return ratings.map((r) => ({
        ...r,
        title: catalogMap.get(r.catalog_id)?.title,
        slug: catalogMap.get(r.catalog_id)?.slug,
        image_url: catalogMap.get(r.catalog_id)?.image_url,
      })) as RatedEntry[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

function GameRow({
  rank,
  title,
  slug,
  imageUrl,
  stat,
  statLabel,
}: {
  rank: number;
  title: string;
  slug: string | null;
  imageUrl: string | null;
  stat: string | number;
  statLabel: string;
}) {
  const content = (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <span className="text-lg font-bold text-muted-foreground w-8 text-right shrink-0">
        {rank}
      </span>
      <div className="h-12 w-12 rounded-md overflow-hidden bg-muted shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <Dices className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{title}</p>
      </div>
      <Badge variant="secondary" className="shrink-0">
        {stat} {statLabel}
      </Badge>
    </div>
  );

  if (slug) {
    return (
      <Link to={`/catalog/${slug}`} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

export default function CatalogAnalytics() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("ownership");
  const ownership = useTopByOwnership();
  const plays = useTopByPlays();
  const ratings = useTopByRating();

  return (
    <Layout hideSidebar>
      <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6 pb-24">
        <Link to="/catalog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" />
          {t('catalogAnalytics.backToCatalog')}
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            {t('catalogAnalytics.title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('catalogAnalytics.subtitle')}</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="ownership" className="flex-1 gap-1">
              <Trophy className="h-4 w-4" /> {t('catalogAnalytics.mostOwned')}
            </TabsTrigger>
            <TabsTrigger value="plays" className="flex-1 gap-1">
              <Dices className="h-4 w-4" /> {t('catalogAnalytics.mostPlayed')}
            </TabsTrigger>
            <TabsTrigger value="ratings" className="flex-1 gap-1">
              <Star className="h-4 w-4" /> {t('catalogAnalytics.highestRated')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ownership">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t('catalogAnalytics.mostOwnedGames')}</CardTitle>
                <CardDescription>{t('catalogAnalytics.mostOwnedDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="p-2">
                {ownership.isLoading && <p className="text-sm text-muted-foreground p-4">{t('common.loading')}</p>}
                {ownership.data?.map((entry, i) => (
                  <GameRow key={entry.catalog_id} rank={i + 1} title={entry.title} slug={entry.slug} imageUrl={entry.image_url}
                    stat={entry.library_count} statLabel={entry.library_count === 1 ? t('catalogAnalytics.library') : t('catalogAnalytics.libraries')} />
                ))}
                {ownership.data?.length === 0 && <p className="text-sm text-muted-foreground p-4">{t('catalogAnalytics.noData')}</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plays">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t('catalogAnalytics.mostPlayedGames')}</CardTitle>
                <CardDescription>{t('catalogAnalytics.mostPlayedDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="p-2">
                {plays.isLoading && <p className="text-sm text-muted-foreground p-4">{t('common.loading')}</p>}
                {plays.data?.map((entry, i) => (
                  <GameRow key={entry.catalog_id} rank={i + 1} title={entry.title} slug={entry.slug} imageUrl={entry.image_url}
                    stat={entry.total_plays} statLabel={entry.total_plays === 1 ? t('catalogAnalytics.play') : t('catalogAnalytics.plays')} />
                ))}
                {plays.data?.length === 0 && <p className="text-sm text-muted-foreground p-4">{t('catalogAnalytics.noData')}</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ratings">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t('catalogAnalytics.highestRatedGames')}</CardTitle>
                <CardDescription>{t('catalogAnalytics.highestRatedDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="p-2">
                {ratings.isLoading && <p className="text-sm text-muted-foreground p-4">{t('common.loading')}</p>}
                {ratings.data?.map((entry, i) => (
                  <GameRow key={entry.catalog_id} rank={i + 1} title={entry.title || "Unknown"} slug={entry.slug} imageUrl={entry.image_url}
                    stat={`${entry.average_rating}★`} statLabel={`(${entry.rating_count})`} />
                ))}
                {ratings.data?.length === 0 && <p className="text-sm text-muted-foreground p-4">{t('catalogAnalytics.noData')}</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
