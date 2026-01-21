/**
 * PocketBase Messages Hook
 * 
 * Replaces Supabase messages with PocketBase.
 * No encryption needed - PocketBase stores data securely, admin UI access only.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/integrations/pocketbase/client';
import { Collections, type GameMessage } from '@/integrations/pocketbase/types';

export interface GameMessageWithGame {
  id: string;
  game_id: string;
  sender_name: string;
  sender_email: string;
  message: string;
  is_read: boolean;
  created_at: string;
  game?: {
    title: string;
    slug: string | null;
  } | null;
}

export function useMessages() {
  return useQuery({
    queryKey: ['messages'],
    queryFn: async (): Promise<GameMessageWithGame[]> => {
      const records = await pb.collection(Collections.GAME_MESSAGES).getFullList<GameMessage & { expand?: { game?: { title: string; slug: string } } }>({
        sort: '-created',
        expand: 'game',
      });

      return records.map(r => ({
        id: r.id,
        game_id: r.game,
        sender_name: r.sender_name,
        sender_email: r.sender_email,
        message: r.message,
        is_read: r.is_read,
        created_at: r.created,
        game: r.expand?.game 
          ? { title: r.expand.game.title, slug: r.expand.game.slug }
          : null,
      }));
    },
  });
}

export function useUnreadMessageCount() {
  return useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: async (): Promise<number> => {
      const result = await pb.collection(Collections.GAME_MESSAGES).getList(1, 1, {
        filter: 'is_read = false',
      });
      return result.totalItems;
    },
  });
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await pb.collection(Collections.GAME_MESSAGES).update(id, { is_read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await pb.collection(Collections.GAME_MESSAGES).delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

// Function to send a message (called from contact form)
export async function sendMessage(data: {
  game_id: string;
  sender_name: string;
  sender_email: string;
  message: string;
}) {
  await pb.collection(Collections.GAME_MESSAGES).create({
    game: data.game_id,
    sender_name: data.sender_name,
    sender_email: data.sender_email,
    message: data.message,
    is_read: false,
  });
}
