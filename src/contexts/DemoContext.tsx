import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { GameWithRelations } from "@/types/game";

// Sample demo games
const DEMO_GAMES: GameWithRelations[] = [
  {
    id: "demo-1",
    title: "Catan",
    description: "Trade, build, and settle the island of Catan in this classic strategy game.",
    image_url: "https://cf.geekdo-images.com/W3Bsga_uLP9kO91gZ7H8yw__imagepage/img/M_3Jx5XpWHgLVzFKqY6Jf0GFvhA=/fit-in/900x600/filters:no_upscale():strip_icc()/pic2419375.jpg",
    difficulty: "2 - Medium Light",
    game_type: "Board Game",
    play_time: "60+ Minutes",
    min_players: 3,
    max_players: 4,
    suggested_age: "10+",
    publisher_id: "demo-pub-1",
    publisher: { id: "demo-pub-1", name: "Catan Studio" },
    mechanics: [{ id: "demo-mech-1", name: "Trading" }],
    bgg_url: null,
    bgg_id: null,
    is_coming_soon: false,
    is_for_sale: false,
    sale_price: null,
    sale_condition: null,
    is_expansion: false,
    parent_game_id: null,
    slug: "catan",
    additional_images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    title: "Ticket to Ride",
    description: "Build train routes across the country and complete destination tickets.",
    image_url: "https://cf.geekdo-images.com/ZWJg0dCdrWHxVnc0eFXK8w__imagepage/img/FcSGhB3Hs-uF9rC3BvJGwU6JnEM=/fit-in/900x600/filters:no_upscale():strip_icc()/pic38668.jpg",
    difficulty: "1 - Light",
    game_type: "Board Game",
    play_time: "45-60 Minutes",
    min_players: 2,
    max_players: 5,
    suggested_age: "8+",
    publisher_id: "demo-pub-2",
    publisher: { id: "demo-pub-2", name: "Days of Wonder" },
    mechanics: [{ id: "demo-mech-2", name: "Set Collection" }],
    bgg_url: null,
    bgg_id: null,
    is_coming_soon: false,
    is_for_sale: true,
    sale_price: 35,
    sale_condition: "Like New",
    is_expansion: false,
    parent_game_id: null,
    slug: "ticket-to-ride",
    additional_images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-3",
    title: "Wingspan",
    description: "Attract birds to your wildlife preserves in this engine-building game.",
    image_url: "https://cf.geekdo-images.com/yLZJCVLlIx4c7eJEWUNJ7w__imagepage/img/uIjeoKgHMcRtzRSR4MoUYl3nXxs=/fit-in/900x600/filters:no_upscale():strip_icc()/pic4458123.jpg",
    difficulty: "3 - Medium",
    game_type: "Card Game",
    play_time: "60+ Minutes",
    min_players: 1,
    max_players: 5,
    suggested_age: "10+",
    publisher_id: "demo-pub-3",
    publisher: { id: "demo-pub-3", name: "Stonemaier Games" },
    mechanics: [
      { id: "demo-mech-3", name: "Engine Building" },
      { id: "demo-mech-4", name: "Hand Management" },
    ],
    bgg_url: null,
    bgg_id: null,
    is_coming_soon: false,
    is_for_sale: false,
    sale_price: null,
    sale_condition: null,
    is_expansion: false,
    parent_game_id: null,
    slug: "wingspan",
    additional_images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-4",
    title: "Gloomhaven",
    description: "A tactical combat game with a persistent campaign and legacy elements.",
    image_url: "https://cf.geekdo-images.com/sZYp_3BTDGjh2unaZfZmuA__imagepage/img/pBaOL7vV402nn1I5dHsdSKsFHqA=/fit-in/900x600/filters:no_upscale():strip_icc()/pic2437871.jpg",
    difficulty: "5 - Heavy",
    game_type: "Board Game",
    play_time: "2+ Hours",
    min_players: 1,
    max_players: 4,
    suggested_age: "14+",
    publisher_id: "demo-pub-4",
    publisher: { id: "demo-pub-4", name: "Cephalofair Games" },
    mechanics: [
      { id: "demo-mech-5", name: "Campaign" },
      { id: "demo-mech-6", name: "Tactical Combat" },
    ],
    bgg_url: null,
    bgg_id: null,
    is_coming_soon: true,
    is_for_sale: false,
    sale_price: null,
    sale_condition: null,
    is_expansion: false,
    parent_game_id: null,
    slug: "gloomhaven",
    additional_images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

interface DemoContextType {
  isDemoMode: boolean;
  demoGames: GameWithRelations[];
  addDemoGame: (game: Partial<GameWithRelations>) => void;
  updateDemoGame: (id: string, game: Partial<GameWithRelations>) => void;
  deleteDemoGame: (id: string) => void;
  resetDemoData: () => void;
}

const DemoContext = createContext<DemoContextType | null>(null);

export function DemoProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [demoGames, setDemoGames] = useState<GameWithRelations[]>(DEMO_GAMES);

  const addDemoGame = useCallback((game: Partial<GameWithRelations>) => {
    const newGame: GameWithRelations = {
      id: `demo-${Date.now()}`,
      title: game.title || "New Game",
      description: game.description || null,
      image_url: game.image_url || null,
      difficulty: game.difficulty || "3 - Medium",
      game_type: game.game_type || "Board Game",
      play_time: game.play_time || "45-60 Minutes",
      min_players: game.min_players || 1,
      max_players: game.max_players || 4,
      suggested_age: game.suggested_age || "10+",
      publisher_id: game.publisher_id || null,
      publisher: game.publisher || null,
      mechanics: game.mechanics || [],
      bgg_url: game.bgg_url || null,
      bgg_id: game.bgg_id || null,
      is_coming_soon: game.is_coming_soon || false,
      is_for_sale: game.is_for_sale || false,
      sale_price: game.sale_price || null,
      sale_condition: game.sale_condition || null,
      is_expansion: game.is_expansion || false,
      parent_game_id: game.parent_game_id || null,
      slug: game.slug || game.title?.toLowerCase().replace(/\s+/g, "-") || "new-game",
      additional_images: game.additional_images || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDemoGames((prev) => [...prev, newGame]);
  }, []);

  const updateDemoGame = useCallback((id: string, updates: Partial<GameWithRelations>) => {
    setDemoGames((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates, updated_at: new Date().toISOString() } : g))
    );
  }, []);

  const deleteDemoGame = useCallback((id: string) => {
    setDemoGames((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const resetDemoData = useCallback(() => {
    setDemoGames(DEMO_GAMES);
  }, []);

  return (
    <DemoContext.Provider
      value={{
        isDemoMode: enabled,
        demoGames,
        addDemoGame,
        updateDemoGame,
        deleteDemoGame,
        resetDemoData,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoContext);
  if (!context) {
    return { isDemoMode: false, demoGames: [], addDemoGame: () => {}, updateDemoGame: () => {}, deleteDemoGame: () => {}, resetDemoData: () => {} };
  }
  return context;
}
