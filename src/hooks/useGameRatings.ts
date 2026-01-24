import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDemoMode } from "@/contexts/DemoContext";

interface RatingSummary {
  game_id: string;
  rating_count: number;
  average_rating: number;
}

interface UserRating {
  game_id: string;
  rating: number;
}

// Generate a stable guest identifier for ratings
function getGuestIdentifier(): string {
  const storageKey = "game_rating_guest_id";
  let guestId = localStorage.getItem(storageKey);
  
  if (!guestId) {
    guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(storageKey, guestId);
  }
  
  return guestId;
}

// Generate device fingerprint for anti-manipulation
function getDeviceFingerprint(): string {
  const storageKey = "game_rating_device_fp";
  let fingerprint = localStorage.getItem(storageKey);
  
  if (!fingerprint) {
    // Create a fingerprint from browser characteristics
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      // @ts-ignore - deviceMemory may not exist
      navigator.deviceMemory || 0,
      navigator.maxTouchPoints || 0,
    ];
    
    // Simple hash function
    const str = components.join("|");
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    fingerprint = `fp_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
    localStorage.setItem(storageKey, fingerprint);
  }
  
  return fingerprint;
}

// Hook to get rating summary for all games
export function useGameRatingsSummary() {
  const { isDemoMode, demoRatings } = useDemoMode();

  return useQuery({
    queryKey: ["game-ratings-summary", isDemoMode],
    queryFn: async (): Promise<RatingSummary[]> => {
      if (isDemoMode) {
        return demoRatings || [];
      }

      const { data, error } = await supabase
        .from("game_ratings_summary")
        .select("*");

      if (error) {
        console.error("Error fetching ratings summary:", error);
        throw error;
      }

      return (data || []).map((r) => ({
        game_id: r.game_id,
        rating_count: r.rating_count || 0,
        average_rating: Number(r.average_rating) || 0,
      }));
    },
  });
}

// Hook to get user's own ratings (via edge function to avoid RLS)
export function useUserRatings() {
  const { isDemoMode, demoUserRatings } = useDemoMode();
  const guestId = getGuestIdentifier();

  return useQuery({
    queryKey: ["user-ratings", guestId, isDemoMode],
    queryFn: async (): Promise<UserRating[]> => {
      if (isDemoMode) {
        return demoUserRatings || [];
      }

      // Use edge function to fetch ratings securely (bypasses RLS)
      const { data, error } = await supabase.functions.invoke(
        `rate-game?guestIdentifier=${encodeURIComponent(guestId)}`,
        {
          method: "GET",
        }
      );

      if (error) {
        console.error("Error fetching user ratings:", error);
        throw error;
      }

      return data?.ratings || [];
    },
  });
}

// Hook to rate a game
export function useRateGame() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isDemoMode, addDemoRating } = useDemoMode();
  const guestId = getGuestIdentifier();
  const deviceFingerprint = getDeviceFingerprint();

  return useMutation({
    mutationFn: async ({ gameId, rating }: { gameId: string; rating: number }) => {
      if (isDemoMode) {
        addDemoRating(gameId, rating);
        return { success: true };
      }

      const { data, error } = await supabase.functions.invoke("rate-game", {
        body: { gameId, rating, guestIdentifier: guestId, deviceFingerprint },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-ratings-summary"] });
      queryClient.invalidateQueries({ queryKey: ["user-ratings"] });
      toast({
        title: "Rating saved",
        description: "Your rating has been recorded.",
      });
    },
    onError: (error: Error) => {
      console.error("Error rating game:", error);
      
      // Handle specific error messages
      let description = "Failed to save your rating. Please try again.";
      if (error.message?.includes("Rate limit")) {
        description = "Too many ratings. Please try again later.";
      } else if (error.message?.includes("already rated")) {
        description = "You have already rated this game.";
      }
      
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    },
  });
}

// Hook to remove a rating
export function useRemoveRating() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isDemoMode, removeDemoRating } = useDemoMode();
  const guestId = getGuestIdentifier();

  return useMutation({
    mutationFn: async (gameId: string) => {
      if (isDemoMode) {
        removeDemoRating(gameId);
        return { success: true };
      }

      const { data, error } = await supabase.functions.invoke("rate-game", {
        method: "DELETE",
        body: { gameId, guestIdentifier: guestId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-ratings-summary"] });
      queryClient.invalidateQueries({ queryKey: ["user-ratings"] });
      toast({
        title: "Rating removed",
        description: "Your rating has been removed.",
      });
    },
    onError: (error) => {
      console.error("Error removing rating:", error);
      toast({
        title: "Error",
        description: "Failed to remove your rating. Please try again.",
        variant: "destructive",
      });
    },
  });
}

// Helper hook to get rating info for a specific game
export function useGameRating(gameId: string) {
  const { data: summaries } = useGameRatingsSummary();
  const { data: userRatings } = useUserRatings();
  
  const summary = summaries?.find((s) => s.game_id === gameId);
  const userRating = userRatings?.find((r) => r.game_id === gameId);
  
  return {
    averageRating: summary?.average_rating || 0,
    ratingCount: summary?.rating_count || 0,
    userRating: userRating?.rating || null,
  };
}
