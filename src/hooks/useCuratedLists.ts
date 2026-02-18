import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "./useAuth";

export interface CuratedList {
  id: string;
  user_id: string;
  library_id: string | null;
  title: string;
  description: string | null;
  is_public: boolean;
  vote_count: number;
  created_at: string;
  updated_at: string;
  author?: { display_name: string | null; username: string | null; avatar_url: string | null };
  items?: CuratedListItem[];
  user_has_voted?: boolean;
}

export interface CuratedListItem {
  id: string;
  list_id: string;
  game_id: string;
  rank: number;
  notes: string | null;
  game?: { title: string; image_url: string | null; slug: string | null };
}

export function useCuratedLists(libraryId?: string | null) {
  return useQuery({
    queryKey: ["curated-lists", libraryId],
    queryFn: async (): Promise<CuratedList[]> => {
      let q = (supabase as any)
        .from("curated_lists")
        .select(`
          *,
          author:user_profiles!curated_lists_user_id_fkey(display_name, username, avatar_url)
        `)
        .eq("is_public", true)
        .order("vote_count", { ascending: false })
        .order("created_at", { ascending: false });

      if (libraryId) q = q.eq("library_id", libraryId);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CuratedList[];
    },
  });
}

export function useCuratedList(listId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["curated-list", listId, user?.id],
    queryFn: async (): Promise<CuratedList | null> => {
      if (!listId) return null;
      const { data: listData, error: listError } = await (supabase as any)
        .from("curated_lists")
        .select(`
          *,
          author:user_profiles!curated_lists_user_id_fkey(display_name, username, avatar_url),
          items:curated_list_items(
            id, list_id, game_id, rank, notes,
            game:games(title, image_url, slug)
          )
        `)
        .eq("id", listId)
        .single();
      if (listError) throw listError;

      let userHasVoted = false;
      if (user && listData) {
        const { data: vote } = await (supabase as any)
          .from("curated_list_votes")
          .select("id")
          .eq("list_id", listId)
          .eq("user_id", user.id)
          .maybeSingle();
        userHasVoted = !!vote;
      }

      if (!listData) return null;
      const items = (listData.items || []).sort((a: CuratedListItem, b: CuratedListItem) => a.rank - b.rank);
      return { ...listData, items, user_has_voted: userHasVoted } as CuratedList;
    },
    enabled: !!listId,
  });
}

export function useMyLists() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-curated-lists", user?.id],
    queryFn: async (): Promise<CuratedList[]> => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("curated_lists")
        .select(`*, items:curated_list_items(id)`)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CuratedList[];
    },
    enabled: !!user,
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; library_id?: string | null; is_public?: boolean }) => {
      if (!user) throw new Error("Must be logged in");
      const { data, error } = await (supabase as any)
        .from("curated_lists")
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curated-lists"] });
      qc.invalidateQueries({ queryKey: ["my-curated-lists"] });
    },
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await (supabase as any).from("curated_lists").delete().eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curated-lists"] });
      qc.invalidateQueries({ queryKey: ["my-curated-lists"] });
    },
  });
}

export function useAddListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { list_id: string; game_id: string; rank: number; notes?: string }) => {
      const { data, error } = await (supabase as any)
        .from("curated_list_items")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_: unknown, v: { list_id: string; game_id: string; rank: number; notes?: string }) => {
      qc.invalidateQueries({ queryKey: ["curated-list", v.list_id] });
    },
  });
}

export function useRemoveListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, listId }: { itemId: string; listId: string }) => {
      const { error } = await (supabase as any).from("curated_list_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: (_: unknown, v: { itemId: string; listId: string }) => {
      qc.invalidateQueries({ queryKey: ["curated-list", v.listId] });
    },
  });
}

export function useVoteList() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ listId, hasVoted }: { listId: string; hasVoted: boolean }) => {
      if (!user) throw new Error("Must be logged in");
      if (hasVoted) {
        const { error } = await (supabase as any)
          .from("curated_list_votes")
          .delete()
          .eq("list_id", listId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("curated_list_votes")
          .insert({ list_id: listId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: (_: unknown, v: { listId: string; hasVoted: boolean }) => {
      qc.invalidateQueries({ queryKey: ["curated-list", v.listId] });
      qc.invalidateQueries({ queryKey: ["curated-lists"] });
    },
  });
}

export function useUpdateListItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, items }: { listId: string; items: { id: string; rank: number; notes?: string | null }[] }) => {
      for (const item of items) {
        const { error } = await (supabase as any)
          .from("curated_list_items")
          .update({ rank: item.rank, notes: item.notes })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: (_: unknown, v: { listId: string }) => {
      qc.invalidateQueries({ queryKey: ["curated-list", v.listId] });
    },
  });
}
