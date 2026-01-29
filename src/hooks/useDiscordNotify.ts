import { supabase } from "@/integrations/supabase/client";

export type DiscordEventType = 
  | "game_added" 
  | "wishlist_vote" 
  | "message_received" 
  | "poll_created" 
  | "poll_closed";

interface DiscordNotifyData {
  library_id: string;
  event_type: DiscordEventType;
  data: Record<string, unknown>;
}

/**
 * Send a Discord notification for a library event.
 * This is a fire-and-forget operation - errors are logged but don't block the main flow.
 */
export async function sendDiscordNotification(payload: DiscordNotifyData): Promise<void> {
  try {
    await supabase.functions.invoke("discord-notify", {
      body: payload,
    });
  } catch (error) {
    // Log but don't throw - Discord notifications shouldn't break main functionality
    console.error("Discord notification failed:", error);
  }
}

/**
 * Hook-friendly wrapper that can be called from mutation onSuccess handlers
 */
export function useDiscordNotify() {
  return {
    notify: sendDiscordNotification,
    
    notifyGameAdded: (libraryId: string, game: {
      title: string;
      image_url?: string | null;
      min_players?: number | null;
      max_players?: number | null;
      play_time?: string | null;
      slug?: string | null;
    }) => {
      const playerCount = game.min_players && game.max_players 
        ? `${game.min_players}-${game.max_players} players`
        : game.min_players 
          ? `${game.min_players}+ players`
          : undefined;
          
      return sendDiscordNotification({
        library_id: libraryId,
        event_type: "game_added",
        data: {
          title: game.title,
          image_url: game.image_url,
          player_count: playerCount,
          play_time: game.play_time,
          // URL will be constructed by the receiver based on tenant context
        },
      });
    },
    
    notifyWishlistVote: (libraryId: string, data: {
      game_title: string;
      image_url?: string | null;
      vote_count: number;
      voter_name?: string | null;
    }) => {
      return sendDiscordNotification({
        library_id: libraryId,
        event_type: "wishlist_vote",
        data,
      });
    },
    
    notifyMessageReceived: (libraryId: string, data: {
      game_title: string;
      sender_name?: string;
    }) => {
      return sendDiscordNotification({
        library_id: libraryId,
        event_type: "message_received",
        data,
      });
    },
    
    notifyPollCreated: (libraryId: string, poll: {
      title: string;
      poll_type: string;
      game_count: number;
      share_token?: string;
    }) => {
      return sendDiscordNotification({
        library_id: libraryId,
        event_type: "poll_created",
        data: {
          poll_title: poll.title,
          poll_type: poll.poll_type,
          game_count: poll.game_count,
          // poll_url will be constructed based on context
        },
      });
    },
    
    notifyPollClosed: (libraryId: string, data: {
      poll_title: string;
      winner_title?: string;
      total_votes: number;
    }) => {
      return sendDiscordNotification({
        library_id: libraryId,
        event_type: "poll_closed",
        data,
      });
    },
  };
}
