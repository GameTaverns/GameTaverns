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

interface DiscordScheduledEventData {
  title: string;
  event_date: string;
  event_location?: string | null;
  description?: string | null;
  poll_url?: string;
  share_token?: string;
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
 * Create a Discord Scheduled Event for a game night poll.
 * This is a fire-and-forget operation - errors are logged but don't block the main flow.
 */
export async function createDiscordScheduledEvent(
  libraryId: string,
  poll: DiscordScheduledEventData & { poll_type?: string; game_count?: number }
): Promise<void> {
  try {
    await supabase.functions.invoke("discord-create-event", {
      body: {
        library_id: libraryId,
        poll_id: poll.share_token || "unknown",
        name: `🎲 ${poll.title}`,
        description: poll.description,
        scheduled_start_time: poll.event_date,
        location: poll.event_location,
        poll_url: poll.poll_url,
      },
    });
  } catch (error) {
    console.error("Discord event creation failed:", error);
  }
}

/**
 * Post an event to a Discord forum channel.
 * This is a fire-and-forget operation - errors are logged but don't block the main flow.
 */
export async function postToDiscordForum(
  libraryId: string,
  event: {
    title: string;
    description?: string | null;
    event_date?: string | null;
    event_location?: string | null;
    poll_url?: string;
    event_type: "poll" | "standalone";
    event_id?: string; // For standalone events to save thread_id
  }
): Promise<void> {
  try {
    await supabase.functions.invoke("discord-forum-post", {
      body: {
        library_id: libraryId,
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        event_location: event.event_location,
        poll_url: event.poll_url,
        event_type: event.event_type,
        event_id: event.event_id,
      },
    });
  } catch (error) {
    console.error("Discord forum post failed:", error);
  }
}

/**
 * Delete a Discord thread when an event is deleted.
 * This is a fire-and-forget operation - errors are logged but don't block the main flow.
 */
export async function deleteDiscordThread(
  libraryId: string,
  threadId: string
): Promise<void> {
  try {
    await supabase.functions.invoke("discord-delete-thread", {
      body: {
        library_id: libraryId,
        thread_id: threadId,
      },
    });
  } catch (error) {
    console.error("Discord thread deletion failed:", error);
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
      event_date?: string | null;
      event_location?: string | null;
      description?: string | null;
      poll_url?: string;
    }) => {
      // Send regular notification
      sendDiscordNotification({
        library_id: libraryId,
        event_type: "poll_created",
        data: {
          poll_title: poll.title,
          poll_type: poll.poll_type,
          game_count: poll.game_count,
          poll_url: poll.poll_url,
        },
      });

      // If it's a game night with an event date, also post to forum channel
      if (poll.poll_type === "game_night" && poll.event_date) {
        // Post to forum channel (preferred method)
        postToDiscordForum(libraryId, {
          title: poll.title,
          description: poll.description,
          event_date: poll.event_date,
          event_location: poll.event_location,
          poll_url: poll.poll_url,
          event_type: "poll",
        });
        
        // Also create Discord scheduled event (optional backup)
        createDiscordScheduledEvent(libraryId, {
          title: poll.title,
          event_date: poll.event_date,
          event_location: poll.event_location,
          description: poll.description,
          poll_url: poll.poll_url,
          share_token: poll.share_token,
        });
      }
    },
    
    notifyEventCreated: (libraryId: string, event: {
      id: string; // Event ID to save thread_id back
      title: string;
      description?: string | null;
      event_date: string;
      event_location?: string | null;
    }) => {
      // Post to forum channel with event_id so thread_id is saved
      // (No separate notification needed - the forum post IS the announcement)
      postToDiscordForum(libraryId, {
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        event_location: event.event_location,
        event_type: "standalone",
        event_id: event.id,
      });
    },
    
    deleteEventThread: (libraryId: string, threadId: string) => {
      return deleteDiscordThread(libraryId, threadId);
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
