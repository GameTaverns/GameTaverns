import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import type { Game, GameWithRelations, Mechanic, Publisher, DifficultyLevel, GameType, PlayTime } from "@/types/game";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useDiscordNotify } from "@/hooks/useDiscordNotify";

export function useGames(enabled = true) {
  const { isAdmin } = useAuth();
  const { library } = useTenant();
  const libraryId = library?.id;

  return useQuery({
    queryKey: ["games", libraryId, isAdmin],
    queryFn: async (): Promise<GameWithRelations[]> => {
      if (!libraryId) return [];

      // Library owners can access full games table for their library
      // Check if current user is the library owner
      const { data: { user } } = await supabase.auth.getUser();
      const isLibraryOwner = user && library?.owner_id === user.id;

      if (isAdmin || isLibraryOwner) {
        const { data: games, error: gamesError } = await supabase
          .from("games")
          .select(
            `
            *,
            publisher:publishers(id, name),
            admin_data:game_admin_data(*),
            game_mechanics(
              mechanic:mechanics(id, name)
            ),
            game_designers(
              designer:designers(id, name)
            ),
            game_artists(
              artist:artists(id, name)
            )
          `
          )
          .eq("library_id", libraryId)
          .order("title");

        if (gamesError) throw gamesError;

        return processGames(games || []);
      }

      // Public: use games_public view (no sensitive admin_data)
      const { data: games, error: gamesError } = await supabase
        .from("games_public")
        .select("*")
        .eq("library_id", libraryId)
        .order("title");

      if (gamesError) throw gamesError;

      // Fetch publishers separately for the view
      // Use batched queries to avoid URL length overflow on large collections
      const gameIds = (games || []).map((g) => g.id);
      const publisherIds = [...new Set((games || []).filter((g) => g.publisher_id).map((g) => g.publisher_id))];

      const BATCH_SIZE = 50;

      // Batch-fetch publishers
      const allPublishers: any[] = [];
      for (let i = 0; i < publisherIds.length; i += BATCH_SIZE) {
        const batch = publisherIds.slice(i, i + BATCH_SIZE);
        const { data } = await supabase.from("publishers").select("id, name").in("id", batch);
        if (data) allPublishers.push(...data);
      }
      const publisherMap = new Map(allPublishers.map((p) => [p.id, p]));

      // Batch-fetch mechanics
      const allMechanics: any[] = [];
      for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
        const batch = gameIds.slice(i, i + BATCH_SIZE);
        const { data } = await supabase
          .from("game_mechanics")
          .select(`game_id, mechanic:mechanics(id, name)`)
          .in("game_id", batch);
        if (data) allMechanics.push(...data);
      }

      const mechanicsMap = new Map<string, Mechanic[]>();
      allMechanics.forEach((gm: { game_id: string; mechanic: Mechanic | null }) => {
        if (gm.mechanic) {
          const existing = mechanicsMap.get(gm.game_id) || [];
          existing.push(gm.mechanic);
          mechanicsMap.set(gm.game_id, existing);
        }
      });

      // Batch-fetch designers
      const allDesignerLinks: any[] = [];
      for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
        const batch = gameIds.slice(i, i + BATCH_SIZE);
        const { data } = await supabase
          .from("game_designers")
          .select(`game_id, designer:designers(id, name)`)
          .in("game_id", batch);
        if (data) allDesignerLinks.push(...data);
      }

      const designersMap = new Map<string, { id: string; name: string }[]>();
      allDesignerLinks.forEach((gd: any) => {
        if (gd.designer) {
          const existing = designersMap.get(gd.game_id) || [];
          existing.push(gd.designer);
          designersMap.set(gd.game_id, existing);
        }
      });

      // Batch-fetch artists
      const allArtistLinks: any[] = [];
      for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
        const batch = gameIds.slice(i, i + BATCH_SIZE);
        const { data } = await supabase
          .from("game_artists")
          .select(`game_id, artist:artists(id, name)`)
          .in("game_id", batch);
        if (data) allArtistLinks.push(...data);
      }

      const artistsMap = new Map<string, { id: string; name: string }[]>();
      allArtistLinks.forEach((ga: any) => {
        if (ga.artist) {
          const existing = artistsMap.get(ga.game_id) || [];
          existing.push(ga.artist);
          artistsMap.set(ga.game_id, existing);
        }
      });

      const gamesWithRelations = (games || []).map((game) => ({
        ...game,
        // Location fields are excluded from public view for security
        location_room: undefined,
        location_shelf: undefined,
        location_misc: undefined,
        admin_data: null,
        publisher: game.publisher_id ? publisherMap.get(game.publisher_id) : null,
        difficulty: game.difficulty as DifficultyLevel,
        game_type: game.game_type as GameType,
        play_time: game.play_time as PlayTime,
        additional_images: game.additional_images || [],
        copies_owned: (game as any).copies_owned ?? 1,
        // Ensure boolean fields are properly cast from nullable view columns
        is_expansion: game.is_expansion === true,
        is_coming_soon: game.is_coming_soon === true,
        is_for_sale: game.is_for_sale === true,
        mechanics: mechanicsMap.get(game.id!) || [],
        designers: designersMap.get(game.id!) || [],
        artists: artistsMap.get(game.id!) || [],
        expansions: [] as GameWithRelations[],
      }));

      return groupExpansions(gamesWithRelations);
    },
    enabled: enabled && !!libraryId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook for getting all games as a flat list (for parent game selection dropdowns)
export function useAllGamesFlat(enabled = true) {
  const { isAdmin } = useAuth();
  const { library } = useTenant();
  const libraryId = library?.id;

  return useQuery({
    queryKey: ["games-flat", libraryId, isAdmin],
    queryFn: async (): Promise<{ id: string; title: string; is_expansion: boolean }[]> => {
      if (!libraryId) return [];

      // Check if current user is the library owner
      const { data: { user } } = await supabase.auth.getUser();
      const isLibraryOwner = user && library?.owner_id === user.id;

      // For parent game selection, we only need id and title of non-expansion games
      if (isAdmin || isLibraryOwner) {
        const { data: games, error } = await supabase
          .from("games")
          .select("id, title, is_expansion")
          .eq("library_id", libraryId)
          .eq("is_expansion", false)
          .order("title");

        if (error) throw error;
        // Defensive mapping: Radix Select requires stable, unique string values.
        return (games || [])
          .filter((g) => !!g.id && !!g.title)
          .map((g) => ({
            id: String(g.id),
            title: String(g.title),
            is_expansion: g.is_expansion === true,
          }));
      }

      // Public users - use the public view
      const { data: games, error } = await supabase
        .from("games_public")
        .select("id, title, is_expansion")
        .eq("library_id", libraryId)
        .eq("is_expansion", false)
        .order("title");

      if (error) throw error;
      return (games || [])
        .filter((g) => !!g.id && !!g.title)
        .map((g) => ({
          id: String(g.id),
          title: String(g.title),
          is_expansion: g.is_expansion === true,
        }));
    },
    enabled: enabled && !!libraryId,
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
    location_misc: game.location_misc ?? null,
    admin_data: normalizeAdminData((game as any).admin_data),
    difficulty: game.difficulty as DifficultyLevel,
    game_type: game.game_type as GameType,
    play_time: game.play_time as PlayTime,
    additional_images: game.additional_images || [],
    mechanics: (game.game_mechanics || [])
      .map((gm: { mechanic: Mechanic | null }) => gm.mechanic)
      .filter((m): m is Mechanic => m !== null),
    designers: (game.game_designers || [])
      .map((gd: any) => gd.designer)
      .filter(Boolean),
    artists: (game.game_artists || [])
      .map((ga: any) => ga.artist)
      .filter(Boolean),
    expansions: [] as GameWithRelations[],
  }));

  return groupExpansions(allGames);
}

function groupExpansions(allGames: GameWithRelations[]): GameWithRelations[] {
  const baseGames: GameWithRelations[] = [];
  const expansionMap = new Map<string, GameWithRelations[]>();

  allGames.forEach((game) => {
    if (game.is_expansion && game.parent_game_id) {
      // Linked expansions are nested under their parent
      const expansions = expansionMap.get(game.parent_game_id) || [];
      expansions.push(game);
      expansionMap.set(game.parent_game_id, expansions);
    } else {
      // Base games AND orphan expansions (no parent) show as top-level entries
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
  const { library } = useTenant();
  const libraryId = library?.id;

  return useQuery({
    queryKey: ["games", slugOrId, isAdmin, libraryId],
    queryFn: async (): Promise<GameWithRelations | null> => {
      if (!slugOrId || !libraryId) return null;

      // Check if it's a UUID or a slug
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

      // Check if current user is the library owner
      const { data: { user } } = await supabase.auth.getUser();
      const isLibraryOwner = user && library?.owner_id === user.id;
      const canAccessAdminData = isAdmin || isLibraryOwner;

      let game: any = null;
      let gameError: any = null;

      if (canAccessAdminData) {
        // Library owners and admins can access full games table with admin_data
        // IMPORTANT: Always filter by library_id to handle duplicate slugs across libraries
        let query = supabase
          .from("games")
          .select(
            `
              *,
              publisher:publishers(id, name),
              admin_data:game_admin_data(*)
            `
          )
          .eq("library_id", libraryId);

        const result = await (isUuid ? query.eq("id", slugOrId).maybeSingle() : query.eq("slug", slugOrId).maybeSingle());
        game = result.data;
        gameError = result.error;
      } else {
        // Public users use the public view
        // IMPORTANT: Always filter by library_id to handle duplicate slugs across libraries
        let query = supabase.from("games_public").select("*").eq("library_id", libraryId);

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

        if (game) {
          game.admin_data = null;
        }
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

      // Fetch designers
      const { data: gameDesigners } = await supabase
        .from("game_designers")
        .select("designer:designers(id, name)")
        .eq("game_id", game.id);
      const designers = gameDesigners?.map((gd: any) => gd.designer).filter(Boolean) || [];

      // Fetch artists
      const { data: gameArtists } = await supabase
        .from("game_artists")
        .select("artist:artists(id, name)")
        .eq("game_id", game.id);
      const artists = gameArtists?.map((ga: any) => ga.artist).filter(Boolean) || [];

      return {
        ...game,
        admin_data: canAccessAdminData ? normalizeAdminData((game as any).admin_data) : null,
        difficulty: game.difficulty as DifficultyLevel,
        game_type: game.game_type as GameType,
        play_time: game.play_time as PlayTime,
        additional_images: game.additional_images || [],
        mechanics,
        designers,
        artists,
      };
    },
    enabled: !!slugOrId && !!libraryId,
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

export function useDesigners() {
  return useQuery({
    queryKey: ["designers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });
}

export function useArtists() {
  return useQuery({
    queryKey: ["artists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artists")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();
  const { library } = useTenant();
  const { notifyGameAdded } = useDiscordNotify();

  return useMutation({
    mutationFn: async (gameData: {
      game: Omit<Game, "id" | "created_at" | "updated_at">;
      mechanicIds: string[];
    }) => {
      if (!library?.id) throw new Error("No library context");

      const { cleanedGame, admin } = splitAdminFields(gameData.game as any);

      // Add library_id to the game data
      const gameWithLibrary = {
        ...cleanedGame,
        library_id: library.id,
      };

      const { data: game, error: gameError } = await supabase
        .from("games")
        .insert(gameWithLibrary as any)
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
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["games-flat"] });
      
      // Fire Discord notification (fire-and-forget)
      if (library?.id) {
        notifyGameAdded(library.id, {
          title: game.title,
          image_url: game.image_url,
          min_players: game.min_players,
          max_players: game.max_players,
          play_time: game.play_time,
          slug: game.slug,
        });
      }
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
      queryClient.invalidateQueries({ queryKey: ["games-flat"] });
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
      queryClient.invalidateQueries({ queryKey: ["games-flat"] });
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
