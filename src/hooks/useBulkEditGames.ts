import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export type BulkEditField =
  | "is_unplayed"
  | "crowdfunded"
  | "sleeved"
  | "upgraded_components"
  | "inserts"
  | "is_for_sale"
  | "is_coming_soon"
  | "game_type"
  | "difficulty"
  | "location_room"
  | "location_shelf"
  | "location_misc"
  | "sale_price"
  | "sale_condition";

export type BulkEditMode = "set" | "toggle";

export interface BulkEditPayload {
  gameIds: string[];
  field: BulkEditField;
  mode: BulkEditMode;
  value?: any;
}

const BOOLEAN_FIELDS: BulkEditField[] = [
  "is_unplayed",
  "crowdfunded",
  "sleeved",
  "upgraded_components",
  "inserts",
  "is_for_sale",
  "is_coming_soon",
];

export function isBooleanField(field: BulkEditField): boolean {
  return BOOLEAN_FIELDS.includes(field);
}

export function useBulkEditGames() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BulkEditPayload) => {
      const { gameIds, field, mode, value } = payload;

      if (mode === "set") {
        // Set all selected games to the same value
        const { error } = await supabase
          .from("games")
          .update({ [field]: value } as any)
          .in("id", gameIds);

        if (error) throw error;
      } else {
        // Toggle mode: fetch current values, then flip each
        const { data: games, error: fetchError } = await supabase
          .from("games")
          .select(`id, ${field}`)
          .in("id", gameIds);

        if (fetchError) throw fetchError;

        // Update each game individually with toggled value
        const updates = (games || []).map((game: any) =>
          supabase
            .from("games")
            .update({ [field]: !game[field] } as any)
            .eq("id", game.id)
        );

        const results = await Promise.all(updates);
        const firstError = results.find((r) => r.error);
        if (firstError?.error) throw firstError.error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["games-flat"] });
    },
  });
}
