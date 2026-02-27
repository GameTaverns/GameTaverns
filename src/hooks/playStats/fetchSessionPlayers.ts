import { supabase } from "@/integrations/backend/client";

interface FetchSessionPlayersParams {
  sessionIds: string[];
  select: string;
  batchSize?: number;
}

/**
 * Fetch game_session_players rows by session IDs using safe, small batches
 * to avoid URL length overflows in self-hosted/proxied environments.
 */
export async function fetchSessionPlayersBySessionIds<T>(
  params: FetchSessionPlayersParams
): Promise<T[]> {
  const { sessionIds, select, batchSize = 50 } = params;
  if (sessionIds.length === 0) return [];

  const rows: T[] = [];

  for (let i = 0; i < sessionIds.length; i += batchSize) {
    const batch = sessionIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("game_session_players")
      .select(select)
      .in("session_id", batch);

    if (error) throw error;
    if (data) rows.push(...(data as T[]));
  }

  return rows;
}
