import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Game, GameWithRelations, Mechanic, Publisher, DifficultyLevel, GameType, PlayTime } from "@/types/game";
import { useAuth } from "@/hooks/useAuth";

export function useGames(enabled = true) {
  const { isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ["games", isAdmin],
    queryFn: async (): Promise<GameWithRelations[]> => {
      // Admins can access full games table (including purchase data)
      // Public users access games_public view (excludes sensitive financial data)
      if (isAdmin) {
        // Admin: full access to games table with all columns
        const { data: games, error: gamesError } = await supabase
          .from("games")
          .select(`
            *,
            publisher:publishers(id, name),
            game_mechanics(
              mechanic:mechanics(id, name)
            )
          `)
          .order("title");

        if (gamesError) throw gamesError;

        return processGames(games || []);
      } else {
        // Public: use games_public view (no purchase_price, purchase_date)
        const { data: games, error: gamesError } = await supabase
          .from("games_public")
          .select("*")
          .order("title");

        if (gamesError) throw gamesError;

        // Fetch publishers separately for the view
        const gameIds = (games || []).map(g => g.id);
        const publisherIds = (games || []).filter(g => g.publisher_id).map(g => g.publisher_id);
        
        const { data: publishers } = await supabase
          .from("publishers")
          .select("id, name")
          .in("id", publisherIds);
        
        const publisherMap = new Map((publishers || []).map(p => [p.id, p]));
        
        // Fetch mechanics for all games
        const { data: gameMechanics } = await supabase
          .from("game_mechanics")
          .select(`
            game_id,
            mechanic:mechanics(id, name)
          `)
          .in("game_id", gameIds);
        
        const mechanicsMap = new Map<string, Mechanic[]>();
        (gameMechanics || []).forEach((gm: { game_id: string; mechanic: Mechanic | null }) => {
          if (gm.mechanic) {
            const existing = mechanicsMap.get(gm.game_id) || [];
            existing.push(gm.mechanic);
            mechanicsMap.set(gm.game_id, existing);
          }
        });

        const gamesWithRelations = (games || []).map(game => ({
          ...game,
          // Add null values for sensitive fields not in the view
          purchase_price: null,
          purchase_date: null,
          publisher: game.publisher_id ? publisherMap.get(game.publisher_id) : null,
          difficulty: game.difficulty as DifficultyLevel,
          game_type: game.game_type as GameType,
          play_time: game.play_time as PlayTime,
          additional_images: game.additional_images || [],
          mechanics: mechanicsMap.get(game.id) || [],
          expansions: [] as GameWithRelations[],
        }));

        return groupExpansions(gamesWithRelations);
      }
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

function processGames(games: any[]): GameWithRelations[] {
  const allGames = games.map((game) => ({
    ...game,
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

export function useGame(slugOrId: string | undefined) {
  const { isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ["games", slugOrId, isAdmin],
    queryFn: async (): Promise<GameWithRelations | null> => {
      if (!slugOrId) return null;

      // Check if it's a UUID or a slug
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      
      // Admins use games table, public users use games_public view
      const tableName = isAdmin ? "games" : "games_public";
      
      let game: any;
      let gameError: any;
      
      if (isAdmin) {
        const query = supabase
          .from("games")
          .select(`
            *,
            publisher:publishers(id, name)
          `);
        
        const result = await (isUuid 
          ? query.eq("id", slugOrId).single()
          : query.eq("slug", slugOrId).single()
        );
        game = result.data;
        gameError = result.error;
      } else {
        const query = supabase
          .from("games_public")
          .select("*");
        
        const result = await (isUuid 
          ? query.eq("id", slugOrId).single()
          : query.eq("slug", slugOrId).single()
        );
        game = result.data;
        gameError = result.error;
        
        // Fetch publisher separately for view
        if (game?.publisher_id) {
          const { data: publisher } = await supabase
            .from("publishers")
            .select("id, name")
            .eq("id", game.publisher_id)
            .single();
          game.publisher = publisher;
        }
        
        // Add null values for sensitive fields
        game.purchase_price = null;
        game.purchase_date = null;
      }

      if (gameError) throw gameError;

      const { data: gameMechanics, error: mechanicsError } = await supabase
        .from("game_mechanics")
        .select(`
          mechanic:mechanics(id, name)
        `)
        .eq("game_id", game.id);

      if (mechanicsError) throw mechanicsError;

      const mechanics = gameMechanics
        ?.map((gm: { mechanic: Mechanic | null }) => gm.mechanic)
        .filter((m): m is Mechanic => m !== null) || [];

      return {
        ...game,
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
      const { data: game, error: gameError } = await supabase
        .from("games")
        .insert(gameData.game)
        .select()
        .single();

      if (gameError) throw gameError;

      if (gameData.mechanicIds.length > 0) {
        const { error: mechanicsError } = await supabase
          .from("game_mechanics")
          .insert(
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
      const { error: gameError } = await supabase
        .from("games")
        .update(gameData.game)
        .eq("id", gameData.id);

      if (gameError) throw gameError;

      if (gameData.mechanicIds !== undefined) {
        // Delete existing mechanics
        await supabase.from("game_mechanics").delete().eq("game_id", gameData.id);

        // Insert new mechanics
        if (gameData.mechanicIds.length > 0) {
          const { error: mechanicsError } = await supabase
            .from("game_mechanics")
            .insert(
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
