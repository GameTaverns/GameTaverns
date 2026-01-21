/**
 * PocketBase Games Hook
 * 
 * Replaces Supabase games hook with PocketBase queries.
 * Simpler API, no RLS complexity - rules are defined in PocketBase admin.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/integrations/pocketbase/client';
import { Collections, type Game, type GameExpanded, type Publisher, type Mechanic } from '@/integrations/pocketbase/types';
import { useAuth } from '@/hooks/useAuthPocketBase';

// Helper to generate slug from title
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Map PocketBase game to app format
function mapGame(record: GameExpanded): GameWithRelations {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description || null,
    image_url: record.image_url || null,
    additional_images: record.additional_images || [],
    difficulty: record.difficulty,
    game_type: record.game_type,
    play_time: record.play_time,
    min_players: record.min_players,
    max_players: record.max_players,
    suggested_age: record.suggested_age,
    publisher_id: record.publisher || null,
    bgg_id: record.bgg_id || null,
    bgg_url: record.bgg_url || null,
    is_coming_soon: record.is_coming_soon,
    is_for_sale: record.is_for_sale,
    sale_price: record.sale_price || null,
    sale_condition: record.sale_condition || null,
    is_expansion: record.is_expansion,
    parent_game_id: record.parent_game || null,
    in_base_game_box: record.in_base_game_box,
    location_room: record.location_room || null,
    location_shelf: record.location_shelf || null,
    location_misc: record.location_misc || null,
    sleeved: record.sleeved,
    upgraded_components: record.upgraded_components,
    crowdfunded: record.crowdfunded,
    inserts: record.inserts,
    youtube_videos: record.youtube_videos || [],
    created_at: record.created,
    updated_at: record.updated,
    // Relations
    publisher: record.expand?.publisher 
      ? { id: record.expand.publisher.id, name: record.expand.publisher.name }
      : null,
    mechanics: record.expand?.mechanics?.map(m => ({ id: m.id, name: m.name })) || [],
    expansions: [],
    // Admin data
    admin_data: record.purchase_price !== undefined || record.purchase_date !== undefined
      ? {
          id: record.id,
          game_id: record.id,
          purchase_price: record.purchase_price || null,
          purchase_date: record.purchase_date || null,
        }
      : null,
  };
}

// Import the GameWithRelations type
import type { GameWithRelations } from '@/types/game';

// Group expansions under parent games
function groupExpansions(games: GameWithRelations[]): GameWithRelations[] {
  const baseGames: GameWithRelations[] = [];
  const expansionMap = new Map<string, GameWithRelations[]>();

  games.forEach((game) => {
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

export function useGames(enabled = true) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['games', isAdmin],
    queryFn: async (): Promise<GameWithRelations[]> => {
      const records = await pb.collection(Collections.GAMES).getFullList<GameExpanded>({
        sort: 'title',
        expand: 'publisher,mechanics',
      });

      const games = records.map(mapGame);
      
      // Filter out admin-only fields for non-admins
      if (!isAdmin) {
        games.forEach(g => {
          g.location_room = undefined;
          g.location_shelf = undefined;
          g.location_misc = undefined;
          g.admin_data = null;
        });
      }

      return groupExpansions(games);
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useAllGamesFlat(enabled = true) {
  return useQuery({
    queryKey: ['games-flat'],
    queryFn: async (): Promise<{ id: string; title: string; is_expansion: boolean }[]> => {
      const records = await pb.collection(Collections.GAMES).getFullList<Game>({
        filter: 'is_expansion = false',
        sort: 'title',
        fields: 'id,title,is_expansion',
      });

      return records.map(g => ({
        id: g.id,
        title: g.title,
        is_expansion: g.is_expansion,
      }));
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useGame(slugOrId: string | undefined) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['games', slugOrId, isAdmin],
    queryFn: async (): Promise<GameWithRelations | null> => {
      if (!slugOrId) return null;

      try {
        // Try to find by slug first, then by ID
        let record: GameExpanded;
        
        const isUuid = /^[a-z0-9]{15}$/i.test(slugOrId); // PocketBase uses 15-char IDs
        
        if (isUuid) {
          record = await pb.collection(Collections.GAMES).getOne<GameExpanded>(slugOrId, {
            expand: 'publisher,mechanics',
          });
        } else {
          const records = await pb.collection(Collections.GAMES).getList<GameExpanded>(1, 1, {
            filter: `slug = "${slugOrId}"`,
            expand: 'publisher,mechanics',
          });
          if (records.items.length === 0) return null;
          record = records.items[0];
        }

        const game = mapGame(record);

        if (!isAdmin) {
          game.location_room = undefined;
          game.location_shelf = undefined;
          game.location_misc = undefined;
          game.admin_data = null;
        }

        return game;
      } catch {
        return null;
      }
    },
    enabled: !!slugOrId,
  });
}

export function useMechanics() {
  return useQuery({
    queryKey: ['mechanics'],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const records = await pb.collection(Collections.MECHANICS).getFullList<Mechanic>({
        sort: 'name',
      });
      return records.map(m => ({ id: m.id, name: m.name }));
    },
  });
}

export function usePublishers() {
  return useQuery({
    queryKey: ['publishers'],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const records = await pb.collection(Collections.PUBLISHERS).getFullList<Publisher>({
        sort: 'name',
      });
      return records.map(p => ({ id: p.id, name: p.name }));
    },
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gameData: {
      game: Partial<Game>;
      mechanicIds: string[];
    }) => {
      const data = {
        ...gameData.game,
        slug: gameData.game.slug || slugify(gameData.game.title || ''),
        mechanics: gameData.mechanicIds,
      };

      const record = await pb.collection(Collections.GAMES).create(data);
      return record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['games-flat'] });
    },
  });
}

export function useUpdateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gameData: {
      id: string;
      game: Partial<Game>;
      mechanicIds?: string[];
    }) => {
      const data = {
        ...gameData.game,
        ...(gameData.mechanicIds !== undefined && { mechanics: gameData.mechanicIds }),
      };

      await pb.collection(Collections.GAMES).update(gameData.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['games-flat'] });
    },
  });
}

export function useDeleteGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await pb.collection(Collections.GAMES).delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['games-flat'] });
    },
  });
}

export function useCreateMechanic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const record = await pb.collection(Collections.MECHANICS).create({ name });
      return { id: record.id, name };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mechanics'] });
    },
  });
}

export function useCreatePublisher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const record = await pb.collection(Collections.PUBLISHERS).create({ name });
      return { id: record.id, name };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publishers'] });
    },
  });
}
