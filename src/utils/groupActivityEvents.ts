import type { ActivityEvent } from "@/hooks/useActivityFeed";

const GROUPABLE_TYPES = new Set(["game_added", "expansion_added"]);
const MAX_GROUP_SIZE = 9;
// Events within this window (ms) from each other get grouped
const GROUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface GroupedActivityEvent {
  type: "single";
  event: ActivityEvent;
}

export interface BatchedActivityEvent {
  type: "batch";
  event_type: "games_added_batch";
  user_id: string;
  user_display_name?: string;
  user_avatar_url?: string;
  user_username?: string;
  events: ActivityEvent[];
  created_at: string; // most recent
}

export type FeedItem = GroupedActivityEvent | BatchedActivityEvent;

/**
 * Groups consecutive game_added / expansion_added events by the same user
 * within a time window into batched cards (max 9 per batch).
 */
export function groupActivityEvents(events: ActivityEvent[]): FeedItem[] {
  if (!events || events.length === 0) return [];

  const result: FeedItem[] = [];
  let i = 0;

  while (i < events.length) {
    const current = events[i];

    if (!GROUPABLE_TYPES.has(current.event_type)) {
      result.push({ type: "single", event: current });
      i++;
      continue;
    }

    // Collect consecutive groupable events from same user within time window
    const batch: ActivityEvent[] = [current];
    let j = i + 1;

    while (
      j < events.length &&
      batch.length < MAX_GROUP_SIZE &&
      GROUPABLE_TYPES.has(events[j].event_type) &&
      events[j].user_id === current.user_id
    ) {
      const timeDiff = Math.abs(
        new Date(current.created_at).getTime() - new Date(events[j].created_at).getTime()
      );
      if (timeDiff > GROUP_WINDOW_MS) break;
      batch.push(events[j]);
      j++;
    }

    if (batch.length === 1) {
      result.push({ type: "single", event: current });
    } else {
      result.push({
        type: "batch",
        event_type: "games_added_batch",
        user_id: current.user_id,
        user_display_name: current.user_display_name,
        user_avatar_url: current.user_avatar_url,
        user_username: current.user_username,
        events: batch,
        created_at: batch[0].created_at,
      });
    }

    i = j;
  }

  return result;
}
