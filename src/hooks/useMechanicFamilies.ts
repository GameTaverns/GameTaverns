import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface MechanicFamily {
  id: string;
  name: string;
  slug: string;
}

/** Fetch all mechanic families ordered by display_order */
export function useMechanicFamilies() {
  return useQuery({
    queryKey: ["mechanic-families"],
    queryFn: async (): Promise<MechanicFamily[]> => {
      const { data, error } = await supabase
        .from("mechanic_families")
        .select("id, name, slug")
        .order("display_order", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 30, // 30 min cache
  });
}

/**
 * Given a list of game IDs, returns a Map of game_id → Set<family_name>.
 * Uses the join path: game_mechanics → mechanics.family_id → mechanic_families.
 */
export function useGameMechanicFamilyMap(gameIds: string[], enabled = true) {
  return useQuery({
    queryKey: ["game-mechanic-family-map", gameIds.sort().join(",")],
    queryFn: async (): Promise<Map<string, Set<string>>> => {
      if (gameIds.length === 0) return new Map();

      const map = new Map<string, Set<string>>();
      const BATCH = 500;

      for (let i = 0; i < gameIds.length; i += BATCH) {
        const batch = gameIds.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from("game_mechanics")
          .select("game_id, mechanic:mechanics(family_id, family:mechanic_families(name))")
          .in("game_id", batch);
        if (error) throw error;

        for (const row of data || []) {
          const mechanic = row.mechanic as any;
          const familyName = mechanic?.family?.name;
          if (!familyName) continue;
          if (!map.has(row.game_id)) map.set(row.game_id, new Set());
          map.get(row.game_id)!.add(familyName);
        }
      }

      return map;
    },
    enabled: enabled && gameIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });
}
