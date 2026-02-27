import { supabase } from "@/integrations/backend/client";

export interface LibrarySessionRow {
  id: string;
  game_id: string;
  played_at: string;
  duration_minutes: number | null;
}

/**
 * Fetch sessions scoped by library via join filtering.
 * Paginates to avoid the default 1000-row limit.
 */
export async function fetchLibrarySessionsForPeriod(params: {
  libraryId: string;
  periodStartIso: string;
  periodEndIso: string;
}): Promise<LibrarySessionRow[]> {
  const { libraryId, periodStartIso, periodEndIso } = params;

  const PAGE_SIZE = 1000;
  const allRows: LibrarySessionRow[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("game_sessions")
      .select(
        "id, game_id, played_at, duration_minutes, games!inner(library_id, is_expansion)"
      )
      .eq("games.library_id", libraryId)
      .eq("games.is_expansion", false)
      .gte("played_at", periodStartIso)
      .lte("played_at", periodEndIso)
      .order("played_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const rows = (data || []).map((row: any) => ({
      id: row.id,
      game_id: row.game_id,
      played_at: row.played_at,
      duration_minutes: row.duration_minutes ?? null,
    }));

    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  return allRows;
}
