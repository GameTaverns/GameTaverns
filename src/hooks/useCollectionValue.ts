import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

export interface GameValueData {
  gameId: string;
  title: string;
  imageUrl: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  currentValue: number | null;
  valueUpdatedAt: string | null;
  bggMarketPrice: number | null;
  bggPriceFetchedAt: string | null;
}

export interface CollectionValueSummary {
  totalPurchaseValue: number;
  totalCurrentValue: number;
  gamesWithValues: number;
  totalGames: number;
  valueChange: number;
  valueChangePercent: number;
}

export function useCollectionValue(libraryId: string | null) {
  return useQuery({
    queryKey: ["collection-value", libraryId],
    queryFn: async (): Promise<{ games: GameValueData[]; summary: CollectionValueSummary }> => {
      if (!libraryId) throw new Error("No library ID");

      // Fetch games with their admin data
      // Use type casting since game_admin_data may have new columns on self-hosted
      const { data: games, error } = await supabase
        .from("games")
        .select(`
          id,
          title,
          image_url,
          game_admin_data (
            purchase_price,
            purchase_date,
            current_value,
            value_updated_at,
            bgg_market_price,
            bgg_price_fetched_at
          )
        `)
        .eq("library_id", libraryId)
        .eq("is_expansion", false)
        .order("title");

      if (error) throw error;

      const gameValues: GameValueData[] = ((games || []) as any[]).map((g) => ({
        gameId: g.id,
        title: g.title,
        imageUrl: g.image_url,
        purchasePrice: g.game_admin_data?.purchase_price ?? null,
        purchaseDate: g.game_admin_data?.purchase_date ?? null,
        currentValue: g.game_admin_data?.current_value ?? null,
        valueUpdatedAt: g.game_admin_data?.value_updated_at ?? null,
        bggMarketPrice: g.game_admin_data?.bgg_market_price ?? null,
        bggPriceFetchedAt: g.game_admin_data?.bgg_price_fetched_at ?? null,
      }));

      // Calculate summary
      let totalPurchase = 0;
      let totalCurrent = 0;
      let gamesWithValues = 0;

      for (const g of gameValues) {
        if (g.purchasePrice) totalPurchase += g.purchasePrice;
        if (g.currentValue) {
          totalCurrent += g.currentValue;
          gamesWithValues++;
        } else if (g.purchasePrice) {
          // Fallback to purchase price if no current value set
          totalCurrent += g.purchasePrice;
        }
      }

      const valueChange = totalCurrent - totalPurchase;
      const valueChangePercent = totalPurchase > 0 ? (valueChange / totalPurchase) * 100 : 0;

      return {
        games: gameValues,
        summary: {
          totalPurchaseValue: totalPurchase,
          totalCurrentValue: totalCurrent,
          gamesWithValues,
          totalGames: gameValues.length,
          valueChange,
          valueChangePercent,
        },
      };
    },
    enabled: !!libraryId,
  });
}

export function useUpdateGameValue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      gameId,
      currentValue,
      purchasePrice,
      purchaseDate,
    }: {
      gameId: string;
      currentValue?: number | null;
      purchasePrice?: number | null;
      purchaseDate?: string | null;
    }) => {
      if (!user) throw new Error("Must be logged in");

      // Build update object with proper typing
      type AdminDataInsert = {
        game_id: string;
        current_value?: number | null;
        value_updated_at?: string | null;
        purchase_price?: number | null;
        purchase_date?: string | null;
      };

      const updateData: AdminDataInsert = { game_id: gameId };

      if (currentValue !== undefined) {
        updateData.current_value = currentValue;
        updateData.value_updated_at = new Date().toISOString();
      }
      if (purchasePrice !== undefined) {
        updateData.purchase_price = purchasePrice;
      }
      if (purchaseDate !== undefined) {
        updateData.purchase_date = purchaseDate;
      }

      const { data, error } = await supabase
        .from("game_admin_data")
        .upsert(updateData as any, { onConflict: "game_id" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-value"] });
    },
  });
}
