import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  content_format: string;
  source_url: string | null;
  image_url: string | null;
  author_name: string | null;
  published_at: string | null;
  status: string;
  upvotes: number;
  downvotes: number;
  view_count: number;
  created_at: string;
  source?: { name: string; logo_url: string | null } | null;
  categories?: { id: string; name: string; slug: string; icon: string | null; color: string | null }[];
}

export interface NewsCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  display_order: number;
}

export function useNewsCategories() {
  return useQuery({
    queryKey: ["news-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as NewsCategory[];
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useNewsFeed(categorySlug?: string, page = 1, perPage = 20) {
  return useQuery({
    queryKey: ["news-feed", categorySlug, page],
    queryFn: async () => {
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      // When filtering by category, use an inner join to filter server-side
      const categoryJoin = categorySlug
        ? `news_article_categories!inner(category:news_categories!inner(id, name, slug, icon, color))`
        : `news_article_categories(category:news_categories(id, name, slug, icon, color))`;

      let query = supabase
        .from("news_articles")
        .select(`
          id, title, slug, summary, image_url, author_name, published_at,
          status, upvotes, downvotes, view_count, source_url, created_at,
          source:news_sources(name, logo_url),
          ${categoryJoin}
        `)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .range(from, to);

      // Filter by category slug server-side via the joined table
      if (categorySlug) {
        query = query.eq("news_article_categories.category.slug", categorySlug);
      }

      const { data, error } = await query;
      if (error) throw error;

      const articles = (data || []).map((a: any) => ({
        ...a,
        source: a.source?.[0] || a.source || null,
        categories: (a.news_article_categories || [])
          .map((nac: any) => nac.category)
          .filter(Boolean),
      }));

      return articles as NewsArticle[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useNewsArticle(slug: string | undefined) {
  return useQuery({
    queryKey: ["news-article", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select(`
          id, title, slug, summary, content, content_format, image_url, 
          author_name, published_at, status, upvotes, downvotes, view_count, 
          source_url, created_at,
          source:news_sources(name, logo_url),
          news_article_categories(
            category:news_categories(id, name, slug, icon, color)
          )
        `)
        .eq("slug", slug!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        source: (data as any).source?.[0] || (data as any).source || null,
        categories: ((data as any).news_article_categories || [])
          .map((nac: any) => nac.category)
          .filter(Boolean),
      } as NewsArticle;
    },
    enabled: !!slug,
  });
}

export function useNewsReaction(articleId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: userReaction } = useQuery({
    queryKey: ["news-reaction", articleId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("news_article_reactions")
        .select("id, reaction_type")
        .eq("article_id", articleId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!articleId && !!user?.id,
  });

  const react = useMutation({
    mutationFn: async (type: "upvote" | "downvote") => {
      if (!user) throw new Error("Must be logged in");

      if (userReaction) {
        // Remove existing reaction
        await supabase
          .from("news_article_reactions")
          .delete()
          .eq("id", userReaction.id);

        // If same type, just remove (toggle off)
        if (userReaction.reaction_type === type) return;
      }

      // Add new reaction
      const { error } = await supabase
        .from("news_article_reactions")
        .insert({ article_id: articleId!, user_id: user.id, reaction_type: type });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-reaction", articleId] });
      queryClient.invalidateQueries({ queryKey: ["news-feed"] });
      queryClient.invalidateQueries({ queryKey: ["news-article"] });
    },
  });

  return { userReaction, react };
}

export function useNewsBookmark(articleId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: isBookmarked } = useQuery({
    queryKey: ["news-bookmark", articleId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("news_bookmarks")
        .select("id")
        .eq("article_id", articleId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!articleId && !!user?.id,
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");
      if (isBookmarked) {
        await supabase
          .from("news_bookmarks")
          .delete()
          .eq("article_id", articleId!)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("news_bookmarks")
          .insert({ article_id: articleId!, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-bookmark", articleId] });
    },
  });

  return { isBookmarked: !!isBookmarked, toggle };
}
