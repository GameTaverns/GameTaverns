import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useState } from "react";

// Generate a stable guest identifier for this browser session
function getGuestIdentifier(): string {
  const storageKey = "guest_wishlist_id";
  let id = localStorage.getItem(storageKey);
  
  if (!id) {
    // Generate a random identifier
    id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
  }
  
  return id;
}

// Get stored guest name
function getStoredGuestName(): string {
  return localStorage.getItem("guest_wishlist_name") || "";
}

// Store guest name
function setStoredGuestName(name: string) {
  if (name.trim()) {
    localStorage.setItem("guest_wishlist_name", name.trim());
  }
}

export function useWishlist() {
  const queryClient = useQueryClient();
  const [guestIdentifier] = useState(() => getGuestIdentifier());
  const [guestName, setGuestName] = useState(() => getStoredGuestName());

  // Fetch vote counts for all games
  const { data: voteCounts, isLoading: isLoadingCounts } = useQuery({
    queryKey: ["wishlist-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_wishlist_summary")
        .select("*");
      
      if (error) throw error;
      
      // Create a map of game_id -> vote_count
      const countMap: Record<string, number> = {};
      data?.forEach((row: { game_id: string; vote_count: number }) => {
        countMap[row.game_id] = Number(row.vote_count);
      });
      return countMap;
    },
    staleTime: 30000, // 30 seconds
  });

  // Fetch this guest's votes
  const { data: myVotes, isLoading: isLoadingVotes } = useQuery({
    queryKey: ["wishlist-my-votes", guestIdentifier],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("wishlist", {
        body: { action: "list", guest_identifier: guestIdentifier },
      });
      
      if (error) throw error;
      return new Set<string>(data?.votes || []);
    },
    staleTime: 30000,
  });

  // Add vote mutation
  const addVoteMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase.functions.invoke("wishlist", {
        body: {
          action: "add",
          game_id: gameId,
          guest_name: guestName || null,
          guest_identifier: guestIdentifier,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist-counts"] });
      queryClient.invalidateQueries({ queryKey: ["wishlist-my-votes"] });
    },
  });

  // Remove vote mutation
  const removeVoteMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase.functions.invoke("wishlist", {
        body: {
          action: "remove",
          game_id: gameId,
          guest_identifier: guestIdentifier,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist-counts"] });
      queryClient.invalidateQueries({ queryKey: ["wishlist-my-votes"] });
    },
  });

  const toggleVote = useCallback(
    (gameId: string) => {
      if (myVotes?.has(gameId)) {
        removeVoteMutation.mutate(gameId);
      } else {
        addVoteMutation.mutate(gameId);
      }
    },
    [myVotes, addVoteMutation, removeVoteMutation]
  );

  const hasVoted = useCallback(
    (gameId: string) => myVotes?.has(gameId) || false,
    [myVotes]
  );

  const getVoteCount = useCallback(
    (gameId: string) => voteCounts?.[gameId] || 0,
    [voteCounts]
  );

  const updateGuestName = useCallback((name: string) => {
    setGuestName(name);
    setStoredGuestName(name);
  }, []);

  return {
    voteCounts,
    myVotes,
    isLoading: isLoadingCounts || isLoadingVotes,
    toggleVote,
    hasVoted,
    getVoteCount,
    guestName,
    updateGuestName,
    isPending: addVoteMutation.isPending || removeVoteMutation.isPending,
  };
}

// Hook for admin to see full wishlist details
export function useWishlistAdmin() {
  return useQuery({
    queryKey: ["wishlist-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_wishlist")
        .select(`
          id,
          game_id,
          guest_name,
          created_at,
          games:game_id (title, slug)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
  });
}
