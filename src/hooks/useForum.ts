import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// Check if a library has community forum enabled
export function useLibraryForumEnabled(libraryId: string | undefined) {
  return useQuery({
    queryKey: ["library-settings", libraryId, "feature_community_forum"],
    queryFn: async () => {
      if (!libraryId) return false;
      
      const { data, error } = await supabase
        .from("library_settings")
        .select("feature_community_forum")
        .eq("library_id", libraryId)
        .maybeSingle();

      if (error) {
        console.warn("Failed to check forum enabled status:", error);
        return true; // Default to enabled on error
      }
      
      // Default to true if no setting exists or if explicitly enabled
      return data?.feature_community_forum !== false;
    },
    enabled: !!libraryId,
  });
}

// Batch check forum enabled status for multiple libraries
export function useLibrariesForumEnabled(libraryIds: string[]) {
  return useQuery({
    queryKey: ["library-settings", "feature_community_forum", libraryIds],
    queryFn: async () => {
      if (libraryIds.length === 0) return new Map<string, boolean>();
      
      const { data, error } = await supabase
        .from("library_settings")
        .select("library_id, feature_community_forum")
        .in("library_id", libraryIds);

      if (error) {
        console.warn("Failed to check forum enabled status:", error);
        // Default all to true on error
        return new Map(libraryIds.map(id => [id, true]));
      }
      
      const enabledMap = new Map<string, boolean>();
      // Set defaults first (true if no setting)
      libraryIds.forEach(id => enabledMap.set(id, true));
      // Override with actual settings
      data?.forEach(setting => {
        enabledMap.set(setting.library_id, setting.feature_community_forum !== false);
      });
      
      return enabledMap;
    },
    enabled: libraryIds.length > 0,
  });
}

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  display_order: number;
  library_id: string | null;
  created_by: string | null;
  is_system: boolean;
  is_archived: boolean;
  rules: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForumThread {
  id: string;
  category_id: string;
  title: string;
  content: string;
  author_id: string;
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  reply_count: number;
  last_reply_at: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    display_name: string | null;
  };
  category?: ForumCategory;
}

export interface ForumReply {
  id: string;
  thread_id: string;
  content: string;
  author_id: string;
  parent_reply_id: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    display_name: string | null;
  };
}

// Fetch site-wide categories (library_id is null)
export function useSiteWideCategories() {
  return useQuery({
    queryKey: ["forum-categories", "site-wide"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forum_categories")
        .select("*")
        .is("library_id", null)
        .eq("is_archived", false)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as ForumCategory[];
    },
  });
}

// Fetch library-specific categories
export function useLibraryCategories(libraryId: string | undefined) {
  return useQuery({
    queryKey: ["forum-categories", "library", libraryId],
    queryFn: async () => {
      if (!libraryId) return [];
      
      const { data, error } = await supabase
        .from("forum_categories")
        .select("*")
        .eq("library_id", libraryId)
        .eq("is_archived", false)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as ForumCategory[];
    },
    enabled: !!libraryId,
  });
}

// Helper to fetch author display names
async function fetchAuthorNames(authorIds: string[]): Promise<Map<string, string>> {
  if (authorIds.length === 0) return new Map();
  
  const { data } = await supabase
    .from("user_profiles")
    .select("user_id, display_name")
    .in("user_id", authorIds);
  
  const map = new Map<string, string>();
  data?.forEach((p) => map.set(p.user_id, p.display_name || "Unknown"));
  return map;
}

// Fetch recent threads for a category
export function useCategoryThreads(categoryId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ["forum-threads", categoryId, limit],
    queryFn: async () => {
      if (!categoryId) return [];

      const { data, error } = await supabase
        .from("forum_threads")
        .select("*")
        .eq("category_id", categoryId)
        .order("is_pinned", { ascending: false })
        .order("last_reply_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      // Fetch author names
      const authorIds = [...new Set(data.map((t) => t.author_id))];
      const authorMap = await fetchAuthorNames(authorIds);
      
      return data.map((t) => ({
        ...t,
        author: { display_name: authorMap.get(t.author_id) || null },
      })) as ForumThread[];
    },
    enabled: !!categoryId,
  });
}

// Fetch recent threads across all site-wide categories
export function useRecentSiteThreads(limit = 5) {
  return useQuery({
    queryKey: ["forum-threads", "site-wide", "recent", limit],
    queryFn: async () => {
      // First get site-wide category IDs
      const { data: categories } = await supabase
        .from("forum_categories")
        .select("id")
        .is("library_id", null)
        .eq("is_archived", false);
      
      if (!categories || categories.length === 0) return [];
      
      const categoryIds = categories.map((c) => c.id);
      
      const { data, error } = await supabase
        .from("forum_threads")
        .select("*, category:forum_categories(*)")
        .in("category_id", categoryIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      // Fetch author names
      const authorIds = [...new Set(data.map((t) => t.author_id))];
      const authorMap = await fetchAuthorNames(authorIds);
      
      return data.map((t) => ({
        ...t,
        author: { display_name: authorMap.get(t.author_id) || null },
      })) as ForumThread[];
    },
  });
}

// Fetch recent threads across user's library memberships
export function useRecentLibraryThreads(libraryIds: string[], limit = 5) {
  return useQuery({
    queryKey: ["forum-threads", "libraries", libraryIds, "recent", limit],
    queryFn: async () => {
      if (libraryIds.length === 0) return [];

      // First get category IDs for these libraries
      const { data: categories } = await supabase
        .from("forum_categories")
        .select("id")
        .in("library_id", libraryIds)
        .eq("is_archived", false);
      
      if (!categories || categories.length === 0) return [];
      
      const categoryIds = categories.map((c) => c.id);

      const { data, error } = await supabase
        .from("forum_threads")
        .select("*, category:forum_categories(*)")
        .in("category_id", categoryIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      // Fetch author names
      const authorIds = [...new Set(data.map((t) => t.author_id))];
      const authorMap = await fetchAuthorNames(authorIds);
      
      return data.map((t) => ({
        ...t,
        author: { display_name: authorMap.get(t.author_id) || null },
      })) as ForumThread[];
    },
    enabled: libraryIds.length > 0,
  });
}

// Fetch a single thread with its replies
export function useThread(threadId: string | undefined) {
  return useQuery({
    queryKey: ["forum-thread", threadId],
    queryFn: async () => {
      if (!threadId) return null;

      const { data, error } = await supabase
        .from("forum_threads")
        .select("*, category:forum_categories(*)")
        .eq("id", threadId)
        .single();

      if (error) throw error;
      
      // Fetch author name
      const authorMap = await fetchAuthorNames([data.author_id]);
      
      return {
        ...data,
        author: { display_name: authorMap.get(data.author_id) || null },
      } as ForumThread;
    },
    enabled: !!threadId,
  });
}

// Fetch replies for a thread
export function useThreadReplies(threadId: string | undefined) {
  return useQuery({
    queryKey: ["forum-replies", threadId],
    queryFn: async () => {
      if (!threadId) return [];

      const { data, error } = await supabase
        .from("forum_replies")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      // Fetch author names
      const authorIds = [...new Set(data.map((r) => r.author_id))];
      const authorMap = await fetchAuthorNames(authorIds);
      
      return data.map((r) => ({
        ...r,
        author: { display_name: authorMap.get(r.author_id) || null },
      })) as ForumReply[];
    },
    enabled: !!threadId,
  });
}

// Create a new thread
export function useCreateThread() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      categoryId,
      title,
      content,
    }: {
      categoryId: string;
      title: string;
      content: string;
    }) => {
      if (!user) throw new Error("Must be logged in");

      const { data, error } = await supabase
        .from("forum_threads")
        .insert({
          category_id: categoryId,
          title,
          content,
          author_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["forum-threads"] });
      toast({
        title: "Thread created",
        description: "Your discussion has been posted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating thread",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Create a reply
export function useCreateReply() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      threadId,
      content,
      parentReplyId,
    }: {
      threadId: string;
      content: string;
      parentReplyId?: string;
    }) => {
      if (!user) throw new Error("Must be logged in");

      const { data, error } = await supabase
        .from("forum_replies")
        .insert({
          thread_id: threadId,
          content,
          author_id: user.id,
          parent_reply_id: parentReplyId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["forum-replies", data.thread_id] });
      queryClient.invalidateQueries({ queryKey: ["forum-threads"] });
      toast({
        title: "Reply posted",
        description: "Your reply has been added.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error posting reply",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Increment view count (uses direct update instead of RPC)
export function useIncrementViewCount() {
  return useMutation({
    mutationFn: async (threadId: string) => {
      // Direct update - silently fail as view count is not critical
      const { error } = await supabase
        .from("forum_threads")
        .update({ view_count: supabase.rpc ? undefined : 0 }) // Placeholder - we'll use raw SQL
        .eq("id", threadId);
      
      if (error) console.warn("Failed to increment view count:", error);
    },
  });
}
