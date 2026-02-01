import { supabase } from "@/integrations/backend/client";

export interface LibrarySessionRow {
  id: string;
  game_id: string;
  played_at: string;
  duration_minutes: number | null;
}

/**
 * Fetch sessions scoped by library via join filtering.
 * Avoids huge `in(game_id, ...)` URLs that can get truncated.
 */
export async function fetchLibrarySessionsForPeriod(params: {
  libraryId: string;
  periodStartIso: string;
  periodEndIso: string;
}): Promise<LibrarySessionRow[]> {
  const { libraryId, periodStartIso, periodEndIso } = params;

  const { data, error } = await supabase
    .from("game_sessions")
    .select(
      "id, game_id, played_at, duration_minutes, games!inner(library_id, is_expansion)"
    )
    .eq("games.library_id", libraryId)
    .eq("games.is_expansion", false)
    .gte("played_at", periodStartIso)
    .lte("played_at", periodEndIso);

  if (error) throw error;

  // Strip the joined `games` object, keep a stable shape
  return (data || []).map((row: any) => ({
    id: row.id,
    game_id: row.game_id,
    played_at: row.played_at,
    duration_minutes: row.duration_minutes ?? null,
  }));
}
