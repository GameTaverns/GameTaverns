import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface UserSearchResult {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export function usePlayerSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((val: string) => {
    setSearchTerm(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedTerm(val), 300);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["user-search", debouncedTerm],
    queryFn: async (): Promise<UserSearchResult[]> => {
      if (!debouncedTerm || debouncedTerm.length < 2) return [];
      const { data, error } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, username, avatar_url")
        .or(
          `display_name.ilike.%${debouncedTerm}%,username.ilike.%${debouncedTerm}%`
        )
        .limit(8);
      if (error) throw error;
      return (data || []) as UserSearchResult[];
    },
    enabled: debouncedTerm.length >= 2,
  });

  return { searchTerm, handleSearch, results, isLoading };
}
