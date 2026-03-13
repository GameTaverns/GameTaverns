import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that subscribes to realtime changes on club_loans and convention_reservations,
 * automatically invalidating the relevant query caches for instant UI updates.
 */
export function useConventionRealtime(libraryId: string | undefined, conventionEventId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!libraryId) return;

    const channel = supabase
      .channel(`convention-live-${libraryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_loans",
          filter: `library_id=eq.${libraryId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["convention-active-loans", libraryId] });
          queryClient.invalidateQueries({ queryKey: ["convention-all-loans", libraryId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [libraryId, queryClient]);

  useEffect(() => {
    if (!conventionEventId) return;

    const channel = supabase
      .channel(`convention-reservations-${conventionEventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "convention_reservations",
          filter: `convention_event_id=eq.${conventionEventId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["convention-reservations", conventionEventId] });
          // Play a subtle notification sound for new reservations
          if (payload.eventType === "INSERT") {
            try {
              const audio = new Audio("data:audio/wav;base64,UklGRl9vT19teleVBmbQBhABAAIAIlYAAFKsAAAEABAAZGF0YTu");
              // Use a simple beep instead
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 880;
              osc.type = "sine";
              gain.gain.value = 0.1;
              osc.start();
              osc.stop(ctx.currentTime + 0.15);
            } catch {
              // Audio context may not be available
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conventionEventId, queryClient]);
}

/**
 * Fetch ALL loans for a library (active + returned) for historical analytics.
 */
export function useConventionAllLoans(libraryId: string | undefined) {
  return useQuery({
    queryKey: ["convention-all-loans", libraryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_loans")
        .select("*, game:games(id, title, slug, image_url, copies_owned)")
        .eq("library_id", libraryId!)
        .order("checked_out_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!libraryId,
  });
}
