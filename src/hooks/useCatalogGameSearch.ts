import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface CatalogSearchResult {
  id: string;
  title: string;
  image_url: string | null;
  year_published: number | null;
  min_players: number | null;
  max_players: number | null;
  description: string | null;
  is_expansion: boolean;
}

export function useCatalogGameSearch(minChars = 3) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((val: string) => {
    setSearchTerm(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedTerm(val), 300);
  }, []);

  const clear = useCallback(() => {
    setSearchTerm("");
    setDebouncedTerm("");
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["catalog-game-search", debouncedTerm],
    queryFn: async (): Promise<CatalogSearchResult[]> => {
      if (!debouncedTerm || debouncedTerm.length < minChars) return [];
      const { data, error } = await supabase
        .from("game_catalog")
        .select("id, title, image_url, year_published, min_players, max_players, description, is_expansion")
        .eq("is_expansion", false)
        .ilike("title", `%${debouncedTerm}%`)
        .order("title")
        .limit(10);
      if (error) throw error;
      return (data || []) as CatalogSearchResult[];
    },
    enabled: debouncedTerm.length >= minChars,
    staleTime: 30_000,
  });

  return { searchTerm, handleSearch, clear, results, isLoading };
}
