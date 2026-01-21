/**
 * PocketBase Wishlist Hook
 * 
 * Replaces Supabase wishlist with PocketBase.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { pb } from '@/integrations/pocketbase/client';
import { Collections, type GameWishlist } from '@/integrations/pocketbase/types';
import { useDemoMode } from '@/contexts/DemoContext';

// Generate a stable guest identifier for this browser session
function getGuestIdentifier(): string {
  const storageKey = 'guest_wishlist_id';
  let id = localStorage.getItem(storageKey);
  
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
  }
  
  return id;
}

// Get stored guest name
function getStoredGuestName(): string {
  return localStorage.getItem('guest_wishlist_name') || '';
}

// Store guest name
function setStoredGuestName(name: string) {
  if (name.trim()) {
    localStorage.setItem('guest_wishlist_name', name.trim());
  }
}

export function useWishlist() {
  const queryClient = useQueryClient();
  const [guestIdentifier] = useState(() => getGuestIdentifier());
  const [guestName, setGuestName] = useState(() => getStoredGuestName());
  
  const { 
    isDemoMode, 
    addDemoWishlistVote, 
    removeDemoWishlistVote, 
    getDemoWishlistVotes, 
    hasVotedForGame 
  } = useDemoMode();

  // Fetch vote counts for all games
  const { data: voteCounts, isLoading: isLoadingCounts } = useQuery({
    queryKey: ['wishlist-counts'],
    queryFn: async () => {
      const records = await pb.collection(Collections.GAME_WISHLIST).getFullList<GameWishlist>();
      
      const countMap: Record<string, number> = {};
      records.forEach(r => {
        countMap[r.game] = (countMap[r.game] || 0) + 1;
      });
      return countMap;
    },
    staleTime: 30000,
    enabled: !isDemoMode,
  });

  // Fetch this guest's votes
  const { data: myVotes, isLoading: isLoadingVotes } = useQuery({
    queryKey: ['wishlist-my-votes', guestIdentifier],
    queryFn: async () => {
      const records = await pb.collection(Collections.GAME_WISHLIST).getFullList<GameWishlist>({
        filter: `guest_identifier = "${guestIdentifier}"`,
      });
      return new Set<string>(records.map(r => r.game));
    },
    staleTime: 30000,
    enabled: !isDemoMode,
  });

  // Add vote mutation
  const addVoteMutation = useMutation({
    mutationFn: async (gameId: string) => {
      await pb.collection(Collections.GAME_WISHLIST).create({
        game: gameId,
        guest_identifier: guestIdentifier,
        guest_name: guestName || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-counts'] });
      queryClient.invalidateQueries({ queryKey: ['wishlist-my-votes'] });
    },
  });

  // Remove vote mutation
  const removeVoteMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const records = await pb.collection(Collections.GAME_WISHLIST).getFullList<GameWishlist>({
        filter: `game = "${gameId}" && guest_identifier = "${guestIdentifier}"`,
      });
      
      if (records.length > 0) {
        await pb.collection(Collections.GAME_WISHLIST).delete(records[0].id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-counts'] });
      queryClient.invalidateQueries({ queryKey: ['wishlist-my-votes'] });
    },
  });

  const toggleVote = useCallback(
    (gameId: string) => {
      if (isDemoMode) {
        if (hasVotedForGame(gameId)) {
          removeDemoWishlistVote(gameId);
        } else {
          addDemoWishlistVote(gameId, guestName || undefined);
        }
      } else {
        if (myVotes?.has(gameId)) {
          removeVoteMutation.mutate(gameId);
        } else {
          addVoteMutation.mutate(gameId);
        }
      }
    },
    [isDemoMode, hasVotedForGame, removeDemoWishlistVote, addDemoWishlistVote, guestName, myVotes, addVoteMutation, removeVoteMutation]
  );

  const hasVoted = useCallback(
    (gameId: string) => {
      if (isDemoMode) {
        return hasVotedForGame(gameId);
      }
      return myVotes?.has(gameId) || false;
    },
    [isDemoMode, hasVotedForGame, myVotes]
  );

  const getVoteCount = useCallback(
    (gameId: string) => {
      if (isDemoMode) {
        return getDemoWishlistVotes(gameId);
      }
      return voteCounts?.[gameId] || 0;
    },
    [isDemoMode, getDemoWishlistVotes, voteCounts]
  );

  const updateGuestName = useCallback((name: string) => {
    setGuestName(name);
    setStoredGuestName(name);
  }, []);

  return {
    voteCounts: isDemoMode ? {} : voteCounts,
    myVotes: isDemoMode ? new Set<string>() : myVotes,
    isLoading: isDemoMode ? false : (isLoadingCounts || isLoadingVotes),
    toggleVote,
    hasVoted,
    getVoteCount,
    guestName,
    updateGuestName,
    isPending: isDemoMode ? false : (addVoteMutation.isPending || removeVoteMutation.isPending),
  };
}

// Admin wishlist view
export function useWishlistAdmin() {
  return useQuery({
    queryKey: ['wishlist-admin'],
    queryFn: async () => {
      const records = await pb.collection(Collections.GAME_WISHLIST).getFullList<GameWishlist & { expand?: { game?: { title: string; slug: string } } }>({
        sort: '-created',
        expand: 'game',
      });
      
      return records.map(r => ({
        id: r.id,
        game_id: r.game,
        guest_name: r.guest_name,
        created_at: r.created,
        games: r.expand?.game 
          ? { title: r.expand.game.title, slug: r.expand.game.slug }
          : null,
      }));
    },
    staleTime: 30000,
  });
}
