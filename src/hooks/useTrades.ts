import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "./useAuth";

export type TradeListingStatus = "active" | "matched" | "completed" | "cancelled";
export type TradeOfferStatus = "pending" | "accepted" | "declined" | "withdrawn" | "completed";
export type SaleCondition = "New" | "Like New" | "Very Good" | "Good" | "Acceptable";

export interface TradeListing {
  id: string;
  user_id: string;
  game_id: string;
  library_id: string;
  condition: SaleCondition;
  notes: string | null;
  willing_to_ship: boolean;
  local_only: boolean;
  status: TradeListingStatus;
  created_at: string;
  game?: {
    id: string;
    title: string;
    image_url: string | null;
    bgg_id: string | null;
  };
  user_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface TradeWant {
  id: string;
  user_id: string;
  bgg_id: string;
  game_title: string;
  notes: string | null;
  priority: number;
  created_at: string;
}

export interface TradeMatch {
  want_id: string;
  want_title: string;
  listing_id: string;
  listing_user_id: string;
  listing_user_name: string | null;
  listing_condition: SaleCondition;
  listing_notes: string | null;
}

export interface TradeOffer {
  id: string;
  offering_user_id: string;
  receiving_user_id: string;
  offering_listing_id: string;
  receiving_listing_id: string | null;
  message: string | null;
  status: TradeOfferStatus;
  created_at: string;
  offering_listing?: TradeListing;
  receiving_listing?: TradeListing;
}

// Note: These tables only exist in self-hosted deployments
// We use type casting to avoid TypeScript errors

// Get user's trade listings (for-trade list)
export function useMyTradeListings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-trade-listings", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await (supabase as any)
        .from("trade_listings")
        .select(`
          *,
          game:games(id, title, image_url, bgg_id)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data || []) as TradeListing[];
    },
    enabled: !!user,
  });
}

// Get user's want list
export function useMyWantList() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-want-list", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await (supabase as any)
        .from("trade_wants")
        .select("*")
        .eq("user_id", user.id)
        .order("priority", { ascending: true });

      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data || []) as TradeWant[];
    },
    enabled: !!user,
  });
}

// Find matches for user's want list
export function useTradeMatches() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["trade-matches", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await (supabase as any)
        .rpc("find_trade_matches", { for_user_id: user.id });

      if (error) {
        // Function doesn't exist in cloud
        if (error.code === "42883") return [];
        throw error;
      }
      return (data || []) as TradeMatch[];
    },
    enabled: !!user,
  });
}

// Get trade offers (received and sent) — uses separate queries to avoid PostgREST join issues
export function useTradeOffers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["trade-offers", user?.id],
    queryFn: async () => {
      if (!user) return { received: [], sent: [] };

      // Fetch received offers
      const { data: received, error: recvError } = await (supabase as any)
        .from("trade_offers")
        .select("*")
        .eq("receiving_user_id", user.id)
        .order("created_at", { ascending: false });

      if (recvError && recvError.code !== "42P01") throw recvError;

      // Fetch sent offers
      const { data: sent, error: sentError } = await (supabase as any)
        .from("trade_offers")
        .select("*")
        .eq("offering_user_id", user.id)
        .order("created_at", { ascending: false });

      if (sentError && sentError.code !== "42P01") throw sentError;

      const allOffers = [...(received || []), ...(sent || [])];

      // Collect unique listing IDs to fetch separately
      const listingIds = [...new Set(
        allOffers
          .flatMap(o => [o.offering_listing_id, o.receiving_listing_id])
          .filter(Boolean)
      )];

      let listingsMap: Record<string, any> = {};
      let gamesMap: Record<string, any> = {};

      if (listingIds.length > 0) {
        const { data: listings } = await (supabase as any)
          .from("trade_listings")
          .select("*")
          .in("id", listingIds);

        if (listings) {
          for (const l of listings) listingsMap[l.id] = l;

          const gameIds = [...new Set(listings.map((l: any) => l.game_id).filter(Boolean))];
          if (gameIds.length > 0) {
            const { data: games } = await (supabase as any)
              .from("games")
              .select("id, title, image_url")
              .in("id", gameIds);

            if (games) {
              for (const g of games) gamesMap[g.id] = g;
            }
          }
        }
      }

      // Enrich offers with listing + game data
      const enrich = (offer: any) => {
        const listing = listingsMap[offer.offering_listing_id];
        return {
          ...offer,
          offering_listing: listing ? {
            ...listing,
            game: gamesMap[listing.game_id] || null,
          } : null,
        };
      };

      return {
        received: (received || []).map(enrich) as TradeOffer[],
        sent: (sent || []).map(enrich) as TradeOffer[],
      };
    },
    enabled: !!user,
  });
}

// Add game to for-trade list
export function useAddTradeListing() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (listing: {
      game_id: string;
      library_id: string;
      condition: SaleCondition;
      notes?: string;
      willing_to_ship?: boolean;
      local_only?: boolean;
    }) => {
      if (!user) throw new Error("Must be logged in");

      const { data, error } = await (supabase as any)
        .from("trade_listings")
        .insert({
          ...listing,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TradeListing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-trade-listings"] });
    },
  });
}

// Remove from for-trade list
export function useRemoveTradeListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await (supabase as any)
        .from("trade_listings")
        .delete()
        .eq("id", listingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-trade-listings"] });
    },
  });
}

// Add to want list
export function useAddWant() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (want: {
      bgg_id: string;
      game_title: string;
      notes?: string;
      priority?: number;
    }) => {
      if (!user) throw new Error("Must be logged in");

      const { data, error } = await (supabase as any)
        .from("trade_wants")
        .insert({
          ...want,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TradeWant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-want-list"] });
      queryClient.invalidateQueries({ queryKey: ["trade-matches"] });
    },
  });
}

// Remove from want list
export function useRemoveWant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (wantId: string) => {
      const { error } = await (supabase as any)
        .from("trade_wants")
        .delete()
        .eq("id", wantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-want-list"] });
      queryClient.invalidateQueries({ queryKey: ["trade-matches"] });
    },
  });
}

// Create a trade offer
export function useCreateTradeOffer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (offer: {
      receiving_user_id: string;
      offering_listing_id: string;
      receiving_listing_id?: string;
      message?: string;
    }) => {
      if (!user) throw new Error("Must be logged in");

      const { data, error } = await (supabase as any)
        .from("trade_offers")
        .insert({
          ...offer,
          offering_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TradeOffer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-offers"] });
    },
  });
}

// Respond to trade offer
export function useRespondToTradeOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      offerId,
      status,
    }: {
      offerId: string;
      status: TradeOfferStatus;
    }) => {
      const { data, error } = await (supabase as any)
        .from("trade_offers")
        .update({ status })
        .eq("id", offerId)
        .select()
        .single();

      if (error) throw error;
      return data as TradeOffer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-offers"] });
    },
  });
}
