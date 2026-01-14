import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Game, GameWithRelations, Mechanic, Publisher, DifficultyLevel, GameType, PlayTime } from "@/types/game";

export function useGames(enabled = true) {
  return useQuery({
    queryKey: ["games"],
    queryFn: async (): Promise<GameWithRelations[]> => {
      // Single query with nested joins for better performance
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

      const allGames = (games || []).map((game) => ({
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

      // Group expansions under their parent games
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

      // Attach expansions to their parent games
      baseGames.forEach((game) => {
        game.expansions = expansionMap.get(game.id) || [];
      });

      return baseGames;
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useGame(slugOrId: string | undefined) {
  return useQuery({
    queryKey: ["games", slugOrId],
    queryFn: async (): Promise<GameWithRelations | null> => {
      if (!slugOrId) return null;

      // Check if it's a UUID or a slug
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      
      const query = supabase
        .from("games")
        .select(`
          *,
          publisher:publishers(id, name)
        `);
      
      const { data: game, error: gameError } = await (isUuid 
        ? query.eq("id", slugOrId).single()
        : query.eq("slug", slugOrId).single()
      );

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
