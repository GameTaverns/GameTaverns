import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

function slugifyLocal(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
        return new Map(libraryIds.map((id) => [id, true]));
      }

      const enabledMap = new Map<string, boolean>();
      // Set defaults first (true if no setting)
      libraryIds.forEach((id) => enabledMap.set(id, true));
      // Override with actual settings
      data?.forEach((setting) => {
        enabledMap.set(setting.library_id, setting.feature_community_forum !== false);
      });

      return enabledMap;
    },
    enabled: libraryIds.length > 0,
  });
}

export type CreateForumCategoryInput = {
  scope: "site" | "library";
  libraryId: string | null;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  displayOrder: number;
};

export function useCreateForumCategory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateForumCategoryInput) => {
      if (!user) throw new Error("Must be logged in");

      const slug = slugifyLocal(input.name);
      if (!slug) throw new Error("Invalid category name");

      const { data, error } = await supabase
        .from("forum_categories")
        .insert({
          library_id: input.scope === "site" ? null : input.libraryId,
          name: input.name,
          slug,
          description: input.description,
          icon: input.icon,
          color: input.color,
          display_order: input.displayOrder,
          is_system: false,
          is_archived: false,
          created_by: user.id,
        })
        .select("*")
        .single();

      if (error) throw error;
      return data as ForumCategory;
    },
    onSuccess: (cat) => {
      queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      if (cat.library_id) {
        queryClient.invalidateQueries({ queryKey: ["forum-categories", "library", cat.library_id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["forum-categories", "site-wide"] });
      }
      toast({ title: "Category created" });
    },
    onError: (err: any) => {
      toast({
        title: "Could not create category",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });
}

export function useSetCategoryArchived() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ categoryId, archived }: { categoryId: string; archived: boolean }) => {
      const { data, error } = await supabase
        .from("forum_categories")
        .update({ is_archived: archived, updated_at: new Date().toISOString() })
        .eq("id", categoryId)
        .select("*")
        .single();

      if (error) throw error;
      return data as ForumCategory;
    },
    onSuccess: (cat) => {
      queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      if (cat.library_id) {
        queryClient.invalidateQueries({ queryKey: ["forum-categories", "library", cat.library_id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["forum-categories", "site-wide"] });
      }
      toast({ title: cat.is_archived ? "Category archived" : "Category restored" });
    },
    onError: (err: any) => {
      toast({
        title: "Could not update category",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
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
    featured_badge?: {
      name: string;
      icon: string | null;
      tier: number;
    } | null;
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
    featured_badge?: {
      name: string;
      icon: string | null;
      tier: number;
    } | null;
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

// Author data including featured badge
interface AuthorData {
  display_name: string | null;
  featured_badge?: {
    name: string;
    icon: string | null;
    tier: number;
  } | null;
}

// Helper to fetch author display names and badges
async function fetchAuthorData(authorIds: string[]): Promise<Map<string, AuthorData>> {
  if (authorIds.length === 0) return new Map();
  
  const { data } = await supabase
    .from("user_profiles")
    .select(`
      user_id, 
      display_name,
      featured_achievement:achievements(name, icon, tier)
    `)
    .in("user_id", authorIds);
  
  const map = new Map<string, AuthorData>();
  data?.forEach((p: any) => {
    map.set(p.user_id, {
      display_name: p.display_name || "Unknown",
      featured_badge: p.featured_achievement || null,
    });
  });
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
      
      // Fetch author data with badges
      const authorIds = [...new Set(data.map((t) => t.author_id))];
      const authorMap = await fetchAuthorData(authorIds);
      
      return data.map((t) => ({
        ...t,
        author: authorMap.get(t.author_id) || { display_name: null },
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
      
      // Fetch author data with badges
      const authorIds = [...new Set(data.map((t) => t.author_id))];
      const authorMap = await fetchAuthorData(authorIds);
      
      return data.map((t) => ({
        ...t,
        author: authorMap.get(t.author_id) || { display_name: null },
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
      
      // Fetch author data with badges
      const authorIds = [...new Set(data.map((t) => t.author_id))];
      const authorMap = await fetchAuthorData(authorIds);
      
      return data.map((t) => ({
        ...t,
        author: authorMap.get(t.author_id) || { display_name: null },
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
      
      // Fetch author data with badge
      const authorMap = await fetchAuthorData([data.author_id]);
      
      return {
        ...data,
        author: authorMap.get(data.author_id) || { display_name: null },
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
      
      // Fetch author data with badges
      const authorIds = [...new Set(data.map((r) => r.author_id))];
      const authorMap = await fetchAuthorData(authorIds);
      
      return data.map((r) => ({
        ...r,
        author: authorMap.get(r.author_id) || { display_name: null },
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

// Toggle thread pinned status
export function useToggleThreadPin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ threadId, isPinned }: { threadId: string; isPinned: boolean }) => {
      const { data, error } = await supabase
        .from("forum_threads")
        .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
        .eq("id", threadId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["forum-thread", data.id] });
      queryClient.invalidateQueries({ queryKey: ["forum-threads"] });
      toast({
        title: data.is_pinned ? "Thread pinned" : "Thread unpinned",
        description: data.is_pinned
          ? "This thread will appear at the top of the category."
          : "This thread will now follow normal sorting.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating thread",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Toggle thread locked status
export function useToggleThreadLock() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ threadId, isLocked }: { threadId: string; isLocked: boolean }) => {
      const { data, error } = await supabase
        .from("forum_threads")
        .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
        .eq("id", threadId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["forum-thread", data.id] });
      queryClient.invalidateQueries({ queryKey: ["forum-threads"] });
      toast({
        title: data.is_locked ? "Thread locked" : "Thread unlocked",
        description: data.is_locked
          ? "No new replies can be added to this thread."
          : "Users can now reply to this thread.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating thread",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Delete a thread
export function useDeleteThread() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase
        .from("forum_threads")
        .delete()
        .eq("id", threadId);

      if (error) throw error;
      return threadId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-threads"] });
      toast({
        title: "Thread deleted",
        description: "The thread has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting thread",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
