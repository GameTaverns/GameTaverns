import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface CatalogBarcode {
  id: string;
  barcode: string;
  barcode_type: string;
  catalog_id: string | null;
  game_id: string | null;
  created_by: string;
  created_at: string;
}

/** Look up a barcode to find the linked game/catalog entry.
 *  First checks the catalog_barcodes mapping table, then falls back
 *  to searching the `upc` column on games and game_catalog directly. */
export function useBarcodeLookup(barcode: string | null) {
  return useQuery({
    queryKey: ["barcode-lookup", barcode],
    queryFn: async () => {
      if (!barcode) return null;

      // 1) Check the learn-as-you-go mapping table
      const { data: mapped, error: mappedErr } = await supabase
        .from("catalog_barcodes")
        .select("*, game:games(id, title, image_url, slug, library_id), catalog:game_catalog(id, title, image_url, slug)")
        .eq("barcode", barcode)
        .maybeSingle();
      if (mappedErr) throw mappedErr;
      if (mapped) return mapped as (CatalogBarcode & {
        game?: { id: string; title: string; image_url: string | null; slug: string | null; library_id: string } | null;
        catalog?: { id: string; title: string; image_url: string | null; slug: string | null } | null;
      });

      // 2) Try matching the UPC field on games directly
      const { data: gameByUpc } = await supabase
        .from("games")
        .select("id, title, image_url, slug, library_id")
        .eq("upc", barcode)
        .limit(1)
        .maybeSingle();
      if (gameByUpc) {
        return { barcode, barcode_type: "UPC", catalog_id: null, game_id: gameByUpc.id, created_by: "", created_at: "", id: "",
          game: gameByUpc, catalog: null } as any;
      }

      // 3) Try matching UPC on the catalog
      const { data: catalogByUpc } = await supabase
        .from("game_catalog")
        .select("id, title, image_url, slug")
        .eq("upc", barcode)
        .limit(1)
        .maybeSingle();
      if (catalogByUpc) {
        return { barcode, barcode_type: "UPC", catalog_id: catalogByUpc.id, game_id: null, created_by: "", created_at: "", id: "",
          game: null, catalog: catalogByUpc } as any;
      }

      return null;
    },
    enabled: !!barcode && barcode.length >= 8,
  });
}

/** Save a barcode → game/catalog mapping */
export function useSaveBarcode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      barcode: string;
      barcode_type?: string;
      catalog_id?: string;
      game_id?: string;
      created_by: string;
    }) => {
      const { data, error } = await supabase
        .from("catalog_barcodes")
        .upsert(
          {
            barcode: params.barcode,
            barcode_type: params.barcode_type || "UPC",
            catalog_id: params.catalog_id || null,
            game_id: params.game_id || null,
            created_by: params.created_by,
          },
          { onConflict: "barcode" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["barcode-lookup", data.barcode] });
    },
  });
}
