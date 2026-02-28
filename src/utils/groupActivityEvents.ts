import type { ActivityEvent } from "@/hooks/useActivityFeed";

const TIME_GROUPABLE_TYPES = new Set(["game_added", "expansion_added"]);
const MAX_GROUP_SIZE = 9;
const GROUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface GroupedActivityEvent {
  type: "single";
  event: ActivityEvent;
}

export interface BatchedActivityEvent {
  type: "batch";
  event_type: "games_added_batch" | "photos_posted_batch";
  user_id: string;
  user_display_name?: string;
  user_avatar_url?: string;
  user_username?: string;
  events: ActivityEvent[];
  created_at: string;
}

export type FeedItem = GroupedActivityEvent | BatchedActivityEvent;

/**
 * Groups activity events:
 * - game_added / expansion_added: consecutive same-user within 1hr time window
 * - photo_posted: by shared batch_id in metadata (photos uploaded together)
 */
export function groupActivityEvents(events: ActivityEvent[]): FeedItem[] {
  if (!events || events.length === 0) return [];

  // First pass: group photo_posted by batch_id
  const photoBatches = new Map<string, ActivityEvent[]>();
  const usedPhotoIds = new Set<string>();

  for (const e of events) {
    if ((e.event_type === "photo_posted" || e.event_type === "photo_tagged") && e.metadata?.batch_id) {
      const bid = `${e.user_id}:${e.metadata.batch_id}`;
      if (!photoBatches.has(bid)) photoBatches.set(bid, []);
      photoBatches.get(bid)!.push(e);
      usedPhotoIds.add(e.id);
    }
  }

  // Build photo batch items keyed by earliest event id for ordering
  const photoBatchByFirstId = new Map<string, BatchedActivityEvent>();
  for (const [, batchEvents] of photoBatches) {
    if (batchEvents.length > 1) {
      const first = batchEvents[0];
      photoBatchByFirstId.set(first.id, {
        type: "batch",
        event_type: "photos_posted_batch",
        user_id: first.user_id,
        user_display_name: first.user_display_name,
        user_avatar_url: first.user_avatar_url,
        user_username: first.user_username,
        events: batchEvents,
        created_at: first.created_at,
      });
      // Mark non-first events as consumed
      for (let k = 1; k < batchEvents.length; k++) {
        usedPhotoIds.add(batchEvents[k].id);
      }
    } else {
      // Single photo in batch — don't consume, render as single
      usedPhotoIds.delete(batchEvents[0].id);
    }
  }

  // Second pass: iterate events in order, emit photo batches at first occurrence
  const emittedBatches = new Set<string>();
  const result: FeedItem[] = [];
  let i = 0;

  while (i < events.length) {
    const current = events[i];

    // Check if this is the first event of a photo batch
    if (photoBatchByFirstId.has(current.id) && !emittedBatches.has(current.id)) {
      result.push(photoBatchByFirstId.get(current.id)!);
      emittedBatches.add(current.id);
      i++;
      continue;
    }

    // Skip consumed photo events (non-first in a batch)
    if ((current.event_type === "photo_posted" || current.event_type === "photo_tagged") && usedPhotoIds.has(current.id) && !photoBatchByFirstId.has(current.id)) {
      i++;
      continue;
    }

    // Time-based grouping for games/expansions
    if (TIME_GROUPABLE_TYPES.has(current.event_type)) {
      const batch: ActivityEvent[] = [current];
      let j = i + 1;
      while (
        j < events.length &&
        batch.length < MAX_GROUP_SIZE &&
        TIME_GROUPABLE_TYPES.has(events[j].event_type) &&
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
      continue;
    }

    // Default: single item
    result.push({ type: "single", event: current });
    i++;
  }

  return result;
}
