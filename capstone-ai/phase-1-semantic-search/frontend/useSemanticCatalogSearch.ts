// src/hooks/useSemanticCatalogSearch.ts
//
// Calls the embed-catalog edge function in 'query' mode to get an embedding
// for the user's text, then RPC search_catalog_semantic to retrieve ranked
// catalog rows. Results match CatalogSearchResult from useCatalogGameSearch
// so the existing UI can render them unchanged.

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import type { CatalogSearchResult } from "./useCatalogGameSearch";

export interface SemanticSearchResult extends CatalogSearchResult {
  similarity: number;
}

export function useSemanticCatalogSearch(minChars = 8) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slower debounce than keyword search — semantic is heavier
  const handleSearch = useCallback((val: string) => {
    setSearchTerm(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedTerm(val), 500);
  }, []);

  const clear = useCallback(() => {
    setSearchTerm("");
    setDebouncedTerm("");
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["semantic-catalog-search", debouncedTerm],
    queryFn: async (): Promise<{ results: SemanticSearchResult[]; logId: string | null }> => {
      if (!debouncedTerm || debouncedTerm.length < minChars) return { results: [], logId: null };

      // 1. Get the query embedding from Cortex via edge function
      const { data: embedResp, error: embedErr } = await supabase.functions.invoke("embed-catalog", {
        body: { mode: "query", text: debouncedTerm },
      });
      if (embedErr) throw embedErr;
      const embedding: number[] = embedResp?.embedding;
      if (!embedding?.length) throw new Error("No embedding returned");

      // 2. Run the semantic RPC
      const { data: rows, error: rpcErr } = await supabase.rpc("search_catalog_semantic", {
        query_embedding: embedding as unknown as string,
        match_count: 20,
        exclude_expansions: true,
      });
      if (rpcErr) throw rpcErr;

      const results = (rows ?? []) as SemanticSearchResult[];

      // 3. Log for MRR eval (fire-and-forget)
      const { data: { user } } = await supabase.auth.getUser();
      const { data: log } = await supabase
        .from("search_eval_log")
        .insert({
          query: debouncedTerm,
          search_mode: "semantic",
          result_ids: results.map((r) => r.id),
          user_id: user?.id ?? null,
        })
        .select("id")
        .single();

      return { results, logId: log?.id ?? null };
    },
    enabled: debouncedTerm.length >= minChars,
    staleTime: 60_000,
  });

  // Call this when the user clicks a result so we can compute MRR
  const recordClick = useCallback(async (logId: string | null, resultId: string, rank: number) => {
    if (!logId) return;
    await supabase
      .from("search_eval_log")
      .update({ clicked_id: resultId, clicked_rank: rank })
      .eq("id", logId);
  }, []);

  return {
    searchTerm,
    handleSearch,
    clear,
    results: data?.results ?? [],
    logId: data?.logId ?? null,
    isLoading,
    error,
    recordClick,
  };
}
