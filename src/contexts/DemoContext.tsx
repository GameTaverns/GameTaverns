import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { GameWithRelations } from "@/types/game";

// Session storage key prefix to isolate demo data per tab
const SESSION_KEY_PREFIX = "demo_session_";
const GAMES_KEY = SESSION_KEY_PREFIX + "games";
const FEATURE_FLAGS_KEY = SESSION_KEY_PREFIX + "feature_flags";
const SESSION_ID_KEY = SESSION_KEY_PREFIX + "id";

// Feature flags for demo mode
export interface DemoFeatureFlags {
  playLogs: boolean;
  wishlist: boolean;
  forSale: boolean;
  messaging: boolean;
  comingSoon: boolean;
}

const DEFAULT_DEMO_FEATURE_FLAGS: DemoFeatureFlags = {
  playLogs: true,
  wishlist: true,
  forSale: true,
  messaging: true,
  comingSoon: true,
};

// Demo session data types
interface DemoWishlistEntry {
  gameId: string;
  guestName?: string;
  guestIdentifier: string;
  createdAt: string;
}

interface DemoPlaySession {
  id: string;
  gameId: string;
  playedAt: string;
  durationMinutes?: number;
  notes?: string;
  players: Array<{
    name: string;
    score?: number;
    isWinner: boolean;
    isFirstPlay: boolean;
  }>;
}

interface DemoMessage {
  id: string;
  gameId: string;
  senderName: string;
  senderEmail: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface DemoContextType {
  isDemoMode: boolean;
  sessionId: string | null;
  demoGames: GameWithRelations[];
  demoFeatureFlags: DemoFeatureFlags;
  demoWishlist: DemoWishlistEntry[];
  demoPlaySessions: DemoPlaySession[];
  demoMessages: DemoMessage[];
  addDemoGame: (game: Partial<GameWithRelations>) => void;
  updateDemoGame: (id: string, game: Partial<GameWithRelations>) => void;
  deleteDemoGame: (id: string) => void;
  resetDemoData: () => void;
  setDemoFeatureFlags: (flags: Partial<DemoFeatureFlags>) => void;
  addDemoWishlistVote: (gameId: string, guestName?: string) => void;
  removeDemoWishlistVote: (gameId: string) => void;
  getDemoWishlistVotes: (gameId: string) => number;
  hasVotedForGame: (gameId: string) => boolean;
  addDemoPlaySession: (session: Omit<DemoPlaySession, "id">) => void;
  deleteDemoPlaySession: (id: string) => void;
  addDemoMessage: (message: Omit<DemoMessage, "id" | "isRead" | "createdAt">) => void;
  markDemoMessageRead: (id: string) => void;
  deleteDemoMessage: (id: string) => void;
}

const DemoContext = createContext<DemoContextType | null>(null);

// Generate a unique session ID for this tab
function generateSessionId(): string {
  return `demo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Get or create session ID from sessionStorage
function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

// Helper to load from sessionStorage
function loadFromSession<T>(key: string, defaultValue: T): T {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load from sessionStorage:", e);
  }
  return defaultValue;
}

// Helper to save to sessionStorage
function saveToSession<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Failed to save to sessionStorage:", e);
  }
}

export function DemoProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [demoGames, setDemoGames] = useState<GameWithRelations[]>([]);
  const [demoFeatureFlags, setDemoFeatureFlagsState] = useState<DemoFeatureFlags>(DEFAULT_DEMO_FEATURE_FLAGS);
  const [demoWishlist, setDemoWishlist] = useState<DemoWishlistEntry[]>([]);
  const [demoPlaySessions, setDemoPlaySessions] = useState<DemoPlaySession[]>([]);
  const [demoMessages, setDemoMessages] = useState<DemoMessage[]>([]);
  const [guestIdentifier] = useState(() => `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // Generate unique IDs for demo entities. Using Date.now() alone can collide during bulk operations.
  const createDemoId = useCallback((prefix: string) => {
    // crypto.randomUUID is available in modern browsers.
    const uuid = (globalThis as any)?.crypto?.randomUUID?.() as string | undefined;
    return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  // Initialize session on mount
  useEffect(() => {
    if (enabled) {
      const id = getOrCreateSessionId();
      setSessionId(id);
      
      // Load persisted data from sessionStorage
      const loadedGames = loadFromSession<GameWithRelations[]>(GAMES_KEY, []);

      // Normalize demo game IDs to avoid collisions (older demo sessions used Date.now() based IDs)
      // Colliding IDs can cause Select dropdowns to behave as if multiple items are selected,
      // and can also make expansions appear under multiple parents.
      const idCounts = new Map<string, number>();
      for (const g of loadedGames) {
        if (!g?.id) continue;
        idCounts.set(g.id, (idCounts.get(g.id) || 0) + 1);
      }

      const idRemap = new Map<string, string[]>();
      const normalizeId = (oldId: string) => {
        const list = idRemap.get(oldId) || [];
        if (list.length === 0) {
          // first instance keeps its id
          list.push(oldId);
          idRemap.set(oldId, list);
          return oldId;
        }
        // subsequent duplicates get new unique ids
        const newId = createDemoId("demo");
        list.push(newId);
        idRemap.set(oldId, list);
        return newId;
      };

      // First pass: assign unique ids, tracking which original ids were duplicated.
      const normalizedGames = loadedGames.map((g) => {
        if (!g?.id) {
          return { ...g, id: createDemoId("demo") };
        }
        if ((idCounts.get(g.id) || 0) <= 1) return g;
        return { ...g, id: normalizeId(g.id) };
      });

      // Second pass: fix parent_game_id references when the referenced parent had duplicates.
      // We choose the first instance (the original id) as the canonical parent.
      const duplicateParents = new Set(
        [...idCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id)
      );
      const finalGames = normalizedGames.map((g) => {
        if (!g?.parent_game_id) return g;
        if (!duplicateParents.has(g.parent_game_id)) return g;
        // keep pointing at the canonical parent (original id)
        return { ...g, parent_game_id: g.parent_game_id };
      });

      setDemoGames(finalGames);
      setDemoFeatureFlagsState(loadFromSession(FEATURE_FLAGS_KEY, DEFAULT_DEMO_FEATURE_FLAGS));
      setDemoWishlist(loadFromSession(SESSION_KEY_PREFIX + "wishlist", []));
      setDemoPlaySessions(loadFromSession(SESSION_KEY_PREFIX + "play_sessions", []));
      setDemoMessages(loadFromSession(SESSION_KEY_PREFIX + "messages", []));
    }
  }, [enabled, createDemoId]);

  // Persist games to sessionStorage
  useEffect(() => {
    if (enabled && sessionId) {
      saveToSession(GAMES_KEY, demoGames);
    }
  }, [demoGames, enabled, sessionId]);

  // Persist feature flags
  useEffect(() => {
    if (enabled && sessionId) {
      saveToSession(FEATURE_FLAGS_KEY, demoFeatureFlags);
    }
  }, [demoFeatureFlags, enabled, sessionId]);

  // Persist wishlist
  useEffect(() => {
    if (enabled && sessionId) {
      saveToSession(SESSION_KEY_PREFIX + "wishlist", demoWishlist);
    }
  }, [demoWishlist, enabled, sessionId]);

  // Persist play sessions
  useEffect(() => {
    if (enabled && sessionId) {
      saveToSession(SESSION_KEY_PREFIX + "play_sessions", demoPlaySessions);
    }
  }, [demoPlaySessions, enabled, sessionId]);

  // Persist messages
  useEffect(() => {
    if (enabled && sessionId) {
      saveToSession(SESSION_KEY_PREFIX + "messages", demoMessages);
    }
  }, [demoMessages, enabled, sessionId]);

  const addDemoGame = useCallback((game: Partial<GameWithRelations> & { parent_game_title?: string }) => {
    const newGameId = game.id || createDemoId("demo");
    
    setDemoGames((prev) => {
      // Resolve parent_game_id from parent_game_title if provided but parent_game_id is not set
      let resolvedParentGameId = game.parent_game_id || null;
      if (!resolvedParentGameId && game.parent_game_title) {
        // Search existing games for a matching title
        const parentGame = prev.find(
          (g) => g.title.toLowerCase() === game.parent_game_title!.toLowerCase()
        );
        if (parentGame) {
          resolvedParentGameId = parentGame.id;
        }
      }
      
      const newGame: GameWithRelations = {
        id: newGameId,
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
        parent_game_id: resolvedParentGameId,
        in_base_game_box: game.in_base_game_box || false,
        location_room: game.location_room || null,
        location_shelf: game.location_shelf || null,
        location_misc: game.location_misc || null,
        sleeved: game.sleeved || false,
        upgraded_components: game.upgraded_components || false,
        crowdfunded: game.crowdfunded || false,
        inserts: game.inserts || false,
        youtube_videos: game.youtube_videos || [],
        slug: game.slug || game.title?.toLowerCase().replace(/\s+/g, "-") || "new-game",
        additional_images: game.additional_images || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        admin_data: game.admin_data || null,
      };
      return [...prev, newGame];
    });
  }, [createDemoId]);

  const updateDemoGame = useCallback((id: string, updates: Partial<GameWithRelations>) => {
    setDemoGames((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates, updated_at: new Date().toISOString() } : g))
    );
  }, []);

  const deleteDemoGame = useCallback((id: string) => {
    setDemoGames((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const resetDemoData = useCallback(() => {
    setDemoGames([]);
    setDemoWishlist([]);
    setDemoPlaySessions([]);
    setDemoMessages([]);
    setDemoFeatureFlagsState(DEFAULT_DEMO_FEATURE_FLAGS);
    // Clear sessionStorage
    sessionStorage.removeItem(GAMES_KEY);
    sessionStorage.removeItem(FEATURE_FLAGS_KEY);
    sessionStorage.removeItem(SESSION_KEY_PREFIX + "wishlist");
    sessionStorage.removeItem(SESSION_KEY_PREFIX + "play_sessions");
    sessionStorage.removeItem(SESSION_KEY_PREFIX + "messages");
  }, []);

  const setDemoFeatureFlags = useCallback((flags: Partial<DemoFeatureFlags>) => {
    setDemoFeatureFlagsState((prev) => ({ ...prev, ...flags }));
  }, []);

  // Wishlist functions
  const addDemoWishlistVote = useCallback((gameId: string, guestName?: string) => {
    setDemoWishlist((prev) => {
      // Check if already voted
      const existing = prev.find(
        (e) => e.gameId === gameId && e.guestIdentifier === guestIdentifier
      );
      if (existing) return prev;
      
      return [
        ...prev,
        {
          gameId,
          guestName,
          guestIdentifier,
          createdAt: new Date().toISOString(),
        },
      ];
    });
  }, [guestIdentifier]);

  const removeDemoWishlistVote = useCallback((gameId: string) => {
    setDemoWishlist((prev) =>
      prev.filter((e) => !(e.gameId === gameId && e.guestIdentifier === guestIdentifier))
    );
  }, [guestIdentifier]);

  const getDemoWishlistVotes = useCallback((gameId: string): number => {
    return demoWishlist.filter((e) => e.gameId === gameId).length;
  }, [demoWishlist]);

  const hasVotedForGame = useCallback((gameId: string): boolean => {
    return demoWishlist.some(
      (e) => e.gameId === gameId && e.guestIdentifier === guestIdentifier
    );
  }, [demoWishlist, guestIdentifier]);

  // Play session functions
  const addDemoPlaySession = useCallback((session: Omit<DemoPlaySession, "id">) => {
    const newSession: DemoPlaySession = {
      ...session,
      id: `session-${Date.now()}`,
    };
    setDemoPlaySessions((prev) => [...prev, newSession]);
  }, []);

  const deleteDemoPlaySession = useCallback((id: string) => {
    setDemoPlaySessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Message functions
  const addDemoMessage = useCallback((message: Omit<DemoMessage, "id" | "isRead" | "createdAt">) => {
    const newMessage: DemoMessage = {
      ...message,
      id: `msg-${Date.now()}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setDemoMessages((prev) => [...prev, newMessage]);
  }, []);

  const markDemoMessageRead = useCallback((id: string) => {
    setDemoMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
    );
  }, []);

  const deleteDemoMessage = useCallback((id: string) => {
    setDemoMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <DemoContext.Provider
      value={{
        isDemoMode: enabled,
        sessionId,
        demoGames,
        demoFeatureFlags,
        demoWishlist,
        demoPlaySessions,
        demoMessages,
        addDemoGame,
        updateDemoGame,
        deleteDemoGame,
        resetDemoData,
        setDemoFeatureFlags,
        addDemoWishlistVote,
        removeDemoWishlistVote,
        getDemoWishlistVotes,
        hasVotedForGame,
        addDemoPlaySession,
        deleteDemoPlaySession,
        addDemoMessage,
        markDemoMessageRead,
        deleteDemoMessage,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoContext);
  if (!context) {
    return {
      isDemoMode: false,
      sessionId: null,
      demoGames: [],
      demoFeatureFlags: DEFAULT_DEMO_FEATURE_FLAGS,
      demoWishlist: [],
      demoPlaySessions: [],
      demoMessages: [],
      addDemoGame: () => {},
      updateDemoGame: () => {},
      deleteDemoGame: () => {},
      resetDemoData: () => {},
      setDemoFeatureFlags: () => {},
      addDemoWishlistVote: () => {},
      removeDemoWishlistVote: () => {},
      getDemoWishlistVotes: () => 0,
      hasVotedForGame: () => false,
      addDemoPlaySession: () => {},
      deleteDemoPlaySession: () => {},
      addDemoMessage: () => {},
      markDemoMessageRead: () => {},
      deleteDemoMessage: () => {},
    };
  }
  return context;
}
