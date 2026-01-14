import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "game-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync to localStorage whenever favorites change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // localStorage might be full or disabled
    }
  }, [favorites]);

  const isFavorite = useCallback(
    (gameId: string) => favorites.includes(gameId),
    [favorites]
  );

  const toggleFavorite = useCallback((gameId: string) => {
    setFavorites((prev) =>
      prev.includes(gameId)
        ? prev.filter((id) => id !== gameId)
        : [...prev, gameId]
    );
  }, []);

  const addFavorite = useCallback((gameId: string) => {
    setFavorites((prev) => (prev.includes(gameId) ? prev : [...prev, gameId]));
  }, []);

  const removeFavorite = useCallback((gameId: string) => {
    setFavorites((prev) => prev.filter((id) => id !== gameId));
  }, []);

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    count: favorites.length,
  };
}
