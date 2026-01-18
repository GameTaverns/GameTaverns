import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Game, GameWithRelations, Mechanic, Publisher, DifficultyLevel, GameType, PlayTime } from "@/types/game";
import { useAuth } from "@/hooks/useAuth";

export function useGames(enabled = true) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["games", isAdmin],
    queryFn: async (): Promise<GameWithRelations[]> => {
      // Admins can access full games table
      // Public users access games_public view
      if (isAdmin) {
        const { data: games, error: gamesError } = await supabase
          .from("games")
          .select(
            `
            *,
            publisher:publishers(id, name),
            admin_data:game_admin_data(*),
            game_mechanics(
              mechanic:mechanics(id, name)
            )
          `
          )
          .order("title");

        if (gamesError) throw gamesError;

        return processGames(games || []);
      }

      // Public: use games_public view (no sensitive admin_data)
      const { data: games, error: gamesError } = await supabase
        .from("games_public")
        .select("*")
        .order("title");

      if (gamesError) throw gamesError;

      // Fetch publishers separately for the view
      const gameIds = (games || []).map((g) => g.id);
      const publisherIds = (games || []).filter((g) => g.publisher_id).map((g) => g.publisher_id);

      const { data: publishers } = await supabase
        .from("publishers")
        .select("id, name")
        .in("id", publisherIds);

      const publisherMap = new Map((publishers || []).map((p) => [p.id, p]));

      // Fetch mechanics for all games
      const { data: gameMechanics } = await supabase
        .from("game_mechanics")
        .select(
          `
            game_id,
            mechanic:mechanics(id, name)
          `
        )
        .in("game_id", gameIds);

      const mechanicsMap = new Map<string, Mechanic[]>();
      (gameMechanics || []).forEach((gm: { game_id: string; mechanic: Mechanic | null }) => {
        if (gm.mechanic) {
          const existing = mechanicsMap.get(gm.game_id) || [];
          existing.push(gm.mechanic);
          mechanicsMap.set(gm.game_id, existing);
        }
      });

      const gamesWithRelations = (games || []).map((game) => ({
        ...game,
        admin_data: null,
        publisher: game.publisher_id ? publisherMap.get(game.publisher_id) : null,
        difficulty: game.difficulty as DifficultyLevel,
        game_type: game.game_type as GameType,
        play_time: game.play_time as PlayTime,
        additional_images: game.additional_images || [],
        // Ensure boolean fields are properly cast from nullable view columns
        is_expansion: game.is_expansion === true,
        is_coming_soon: game.is_coming_soon === true,
        is_for_sale: game.is_for_sale === true,
        mechanics: mechanicsMap.get(game.id!) || [],
        expansions: [] as GameWithRelations[],
      }));

      return groupExpansions(gamesWithRelations);
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

type AdminDataRow = {
  id: string;
  game_id: string;
  purchase_price: number | null;
  purchase_date: string | null;
  created_at?: string;
  updated_at?: string;
};

function normalizeAdminData(input: unknown): AdminDataRow | null {
  if (!input) return null;
  // PostgREST can return 1:1 relationships as an object or as a 1-item array.
  if (Array.isArray(input)) return (input[0] as AdminDataRow) ?? null;
  return input as AdminDataRow;
}

function processGames(games: any[]): GameWithRelations[] {
  const allGames = games.map((game) => ({
    ...game,
    admin_data: normalizeAdminData((game as any).admin_data),
    difficulty: game.difficulty as DifficultyLevel,
    game_type: game.game_type as GameType,
    play_time: game.play_time as PlayTime,
    additional_images: game.additional_images || [],
    mechanics: (game.game_mechanics || [])
      .map((gm: { mechanic: Mechanic | null }) => gm.mechanic)
      .filter((m): m is Mechanic => m !== null),
    expansions: [] as GameWithRelations[],
  }));

  return groupExpansions(allGames);
}

function groupExpansions(allGames: GameWithRelations[]): GameWithRelations[] {
  const baseGames: GameWithRelations[] = [];
  const expansionMap = new Map<string, GameWithRelations[]>();

  allGames.forEach((game) => {
    if (game.is_expansion && game.parent_game_id) {
      const expansions = expansionMap.get(game.parent_game_id) || [];
      expansions.push(game);
      expansionMap.set(game.parent_game_id, expansions);
    } else {
      baseGames.push(game);
    }
  });

  baseGames.forEach((game) => {
    game.expansions = expansionMap.get(game.id) || [];
  });

  return baseGames;
}

function splitAdminFields<T extends Record<string, any>>(game: T): {
  cleanedGame: Omit<T, "purchase_price" | "purchase_date">;
  admin: { purchase_price: number | null; purchase_date: string | null };
} {
  const { purchase_price = null, purchase_date = null, ...rest } = game as any;
  return {
    cleanedGame: rest,
    admin: {
      purchase_price: purchase_price ?? null,
      purchase_date: purchase_date ?? null,
    },
  };
}

export function useGame(slugOrId: string | undefined) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["games", slugOrId, isAdmin],
    queryFn: async (): Promise<GameWithRelations | null> => {
      if (!slugOrId) return null;

      // Check if it's a UUID or a slug
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

      let game: any = null;
      let gameError: any = null;

      if (isAdmin) {
        const query = supabase
          .from("games")
          .select(
            `
              *,
              publisher:publishers(id, name),
              admin_data:game_admin_data(*)
            `
          );

        const result = await (isUuid ? query.eq("id", slugOrId).maybeSingle() : query.eq("slug", slugOrId).maybeSingle());
        game = result.data;
        gameError = result.error;
      } else {
        const query = supabase.from("games_public").select("*");

        const result = await (isUuid ? query.eq("id", slugOrId).maybeSingle() : query.eq("slug", slugOrId).maybeSingle());
        game = result.data;
        gameError = result.error;

        if (game?.publisher_id) {
          const { data: publisher } = await supabase
            .from("publishers")
            .select("id, name")
            .eq("id", game.publisher_id)
            .maybeSingle();
          game.publisher = publisher;
        }

        game.admin_data = null;
      }

      if (gameError) throw gameError;
      if (!game) return null;

      const { data: gameMechanics, error: mechanicsError } = await supabase
        .from("game_mechanics")
        .select(
          `
          mechanic:mechanics(id, name)
        `
        )
        .eq("game_id", game.id);

      if (mechanicsError) throw mechanicsError;

      const mechanics =
        gameMechanics?.map((gm: { mechanic: Mechanic | null }) => gm.mechanic).filter((m): m is Mechanic => m !== null) || [];

      return {
        ...game,
        admin_data: isAdmin ? normalizeAdminData((game as any).admin_data) : null,
        difficulty: game.difficulty as DifficultyLevel,
        game_type: game.game_type as GameType,
        play_time: game.play_time as PlayTime,
        additional_images: game.additional_images || [],
        mechanics,
      };
    },
    enabled: !!slugOrId,
  });
}

export function useMechanics() {
  return useQuery({
    queryKey: ["mechanics"],
    queryFn: async (): Promise<Mechanic[]> => {
      const { data, error } = await supabase
        .from("mechanics")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePublishers() {
  return useQuery({
    queryKey: ["publishers"],
    queryFn: async (): Promise<Publisher[]> => {
      const { data, error } = await supabase
        .from("publishers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gameData: {
      game: Omit<Game, "id" | "created_at" | "updated_at">;
      mechanicIds: string[];
    }) => {
      const { cleanedGame, admin } = splitAdminFields(gameData.game as any);

      const { data: game, error: gameError } = await supabase
        .from("games")
        .insert(cleanedGame as any)
        .select()
        .single();

      if (gameError) throw gameError;

      // Save admin-only fields separately (if provided)
      if (admin.purchase_price !== null || admin.purchase_date !== null) {
        const { error: adminError } = await supabase
          .from("game_admin_data")
          .upsert(
            {
              game_id: game.id,
              purchase_price: admin.purchase_price,
              purchase_date: admin.purchase_date,
            },
            { onConflict: "game_id" }
          );
        if (adminError) throw adminError;
      }

      if (gameData.mechanicIds.length > 0) {
        const { error: mechanicsError } = await supabase.from("game_mechanics").insert(
          gameData.mechanicIds.map((mechanicId) => ({
            game_id: game.id,
            mechanic_id: mechanicId,
          }))
        );

        if (mechanicsError) throw mechanicsError;
      }

      return game;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useUpdateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gameData: {
      id: string;
      game: Partial<Omit<Game, "id" | "created_at" | "updated_at">>;
      mechanicIds?: string[];
    }) => {
      const { cleanedGame, admin } = splitAdminFields(gameData.game as any);

      const { error: gameError } = await supabase.from("games").update(cleanedGame as any).eq("id", gameData.id);
      if (gameError) throw gameError;

      // If both are null => treat as "clear" and delete the admin row.
      // Otherwise upsert the row (including explicit nulls).
      if (admin.purchase_price === null && admin.purchase_date === null) {
        await supabase.from("game_admin_data").delete().eq("game_id", gameData.id);
      } else {
        const { error: adminError } = await supabase
          .from("game_admin_data")
          .upsert(
            {
              game_id: gameData.id,
              purchase_price: admin.purchase_price,
              purchase_date: admin.purchase_date,
            },
            { onConflict: "game_id" }
          );
        if (adminError) throw adminError;
      }

      if (gameData.mechanicIds !== undefined) {
        // Delete existing mechanics
        await supabase.from("game_mechanics").delete().eq("game_id", gameData.id);

        // Insert new mechanics
        if (gameData.mechanicIds.length > 0) {
          const { error: mechanicsError } = await supabase.from("game_mechanics").insert(
            gameData.mechanicIds.map((mechanicId) => ({
              game_id: gameData.id,
              mechanic_id: mechanicId,
            }))
          );

          if (mechanicsError) throw mechanicsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useDeleteGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("games").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useCreateMechanic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("mechanics")
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mechanics"] });
    },
  });
}

export function useCreatePublisher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("publishers")
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publishers"] });
    },
  });
}
