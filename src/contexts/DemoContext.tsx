import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { GameWithRelations } from "@/types/game";

// Stable placeholder images for demo games (using picsum with seed for consistency)
const DEMO_GAMES: GameWithRelations[] = [
  {
    id: "demo-1",
    title: "Catan",
    description: "Trade, build, and settle the island of Catan in this classic strategy game.",
    image_url: "https://picsum.photos/seed/catan/400/400",
    difficulty: "2 - Medium Light",
    game_type: "Board Game",
    play_time: "60+ Minutes",
    min_players: 3,
    max_players: 4,
    suggested_age: "10+",
    publisher_id: "demo-pub-1",
    publisher: { id: "demo-pub-1", name: "Catan Studio" },
    mechanics: [{ id: "demo-mech-1", name: "Trading" }, { id: "demo-mech-2", name: "Dice Rolling" }],
    bgg_url: null,
    bgg_id: null,
    is_coming_soon: false,
    is_for_sale: false,
    sale_price: null,
    sale_condition: null,
    is_expansion: false,
    parent_game_id: null,
    location_room: "Living Room",
    location_shelf: "Shelf A",
    purchase_price: 45.00,
    purchase_date: "2023-06-15",
    slug: "catan",
    additional_images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    title: "Ticket to Ride",
    description: "Build train routes across the country and complete destination tickets.",
    image_url: "https://picsum.photos/seed/tickettoride/400/400",
    difficulty: "1 - Light",
    game_type: "Board Game",
    play_time: "45-60 Minutes",
    min_players: 2,
    max_players: 5,
    suggested_age: "8+",
    publisher_id: "demo-pub-2",
    publisher: { id: "demo-pub-2", name: "Days of Wonder" },
    mechanics: [{ id: "demo-mech-3", name: "Set Collection" }, { id: "demo-mech-4", name: "Route Building" }],
    bgg_url: null,
    bgg_id: null,
    is_coming_soon: false,
    is_for_sale: true,
    sale_price: 35,
    sale_condition: "Like New",
    is_expansion: false,
    parent_game_id: null,
    location_room: "Game Room",
    location_shelf: "Shelf B",
    purchase_price: 55.00,
    purchase_date: "2022-12-01",
    slug: "ticket-to-ride",
    additional_images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-3",
    title: "Wingspan",
    description: "Attract birds to your wildlife preserves in this engine-building game.",
    image_url: "https://picsum.photos/seed/wingspan/400/400",
    difficulty: "3 - Medium",
    game_type: "Card Game",
    play_time: "60+ Minutes",
    min_players: 1,
    max_players: 5,
    suggested_age: "10+",
    publisher_id: "demo-pub-3",
    publisher: { id: "demo-pub-3", name: "Stonemaier Games" },
    mechanics: [
      { id: "demo-mech-5", name: "Engine Building" },
      { id: "demo-mech-6", name: "Hand Management" },
    ],
    bgg_url: null,
    bgg_id: null,
    is_coming_soon: false,
    is_for_sale: false,
    sale_price: null,
    sale_condition: null,
    is_expansion: false,
    parent_game_id: null,
    location_room: null,
    location_shelf: null,
    purchase_price: 60.00,
    purchase_date: "2024-03-20",
    slug: "wingspan",
    additional_images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-4",
    title: "Gloomhaven",
    description: "A tactical combat game with a persistent campaign and legacy elements.",
    image_url: "https://picsum.photos/seed/gloomhaven/400/400",
    difficulty: "5 - Heavy",
    game_type: "Board Game",
    play_time: "2+ Hours",
    min_players: 1,
    max_players: 4,
    suggested_age: "14+",
    publisher_id: "demo-pub-4",
    publisher: { id: "demo-pub-4", name: "Cephalofair Games" },
    mechanics: [
      { id: "demo-mech-7", name: "Campaign" },
      { id: "demo-mech-8", name: "Tactical Combat" },
    ],
    bgg_url: null,
    bgg_id: null,
    is_coming_soon: true,
    is_for_sale: false,
    sale_price: null,
    sale_condition: null,
    is_expansion: false,
    parent_game_id: null,
    location_room: null,
    location_shelf: null,
    purchase_price: 140.00,
    purchase_date: null,
    slug: "gloomhaven",
    additional_images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-5",
    title: "Azul",
    description: "Tile-laying game where you draft beautiful Portuguese tiles to decorate your palace.",
    image_url: "https://picsum.photos/seed/azul/400/400",
    difficulty: "2 - Medium Light",
    game_type: "Board Game",
    play_time: "30-45 Minutes",
    min_players: 2,
    max_players: 4,
    suggested_age: "8+",
    publisher_id: "demo-pub-5",
    publisher: { id: "demo-pub-5", name: "Plan B Games" },
    mechanics: [
      { id: "demo-mech-9", name: "Pattern Building" },
      { id: "demo-mech-10", name: "Drafting" },
    ],
    bgg_url: null,
    bgg_id: null,
    is_coming_soon: false,
    is_for_sale: true,
    sale_price: 25,
    sale_condition: "Very Good",
    is_expansion: false,
    parent_game_id: null,
    location_room: "Basement",
    location_shelf: "Shelf C",
    purchase_price: 30.00,
    purchase_date: "2023-09-10",
    slug: "azul",
    additional_images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-6",
    title: "Spirit Island",
    description: "Cooperative game where island spirits defend against colonial invaders.",
    image_url: "https://picsum.photos/seed/spiritisland/400/400",
    difficulty: "4 - Medium Heavy",
    game_type: "Board Game",
    play_time: "2+ Hours",
    min_players: 1,
    max_players: 4,
    suggested_age: "13+",
    publisher_id: "demo-pub-6",
    publisher: { id: "demo-pub-6", name: "Greater Than Games" },
    mechanics: [
      { id: "demo-mech-11", name: "Cooperative" },
      { id: "demo-mech-12", name: "Area Control" },
    ],
    bgg_url: null,
    bgg_id: null,
    is_coming_soon: true,
    is_for_sale: false,
    sale_price: null,
    sale_condition: null,
    is_expansion: false,
    parent_game_id: null,
    location_room: null,
    location_shelf: null,
    purchase_price: 80.00,
    purchase_date: null,
    slug: "spirit-island",
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
      location_room: game.location_room || null,
      location_shelf: game.location_shelf || null,
      purchase_price: game.purchase_price || null,
      purchase_date: game.purchase_date || null,
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
