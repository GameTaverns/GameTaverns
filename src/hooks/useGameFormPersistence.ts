import { useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "gt_game_form_draft";

interface GameFormDraft {
  title: string;
  description: string;
  imageUrl: string;
  difficulty: string;
  gameType: string;
  genre: string;
  playTime: string;
  minPlayers: number;
  maxPlayers: number;
  suggestedAge: string;
  publisherId: string | null;
  selectedMechanics: string[];
  bggUrl: string;
  isComingSoon: boolean;
  isForSale: boolean;
  salePrice: string;
  saleCondition: string | null;
  isExpansion: boolean;
  parentGameId: string | null;
  inBaseGameBox: boolean;
  locationRoom: string;
  locationShelf: string;
  locationMisc: string;
  purchasePrice: string;
  purchaseDate: string;
  currentValue: string;
  sleeved: boolean;
  upgradedComponents: boolean;
  crowdfunded: boolean;
  inserts: boolean;
  isUnplayed: boolean;
  selectedDesigners: string[];
  selectedArtists: string[];
  youtubeVideos: string[];
  copiesOwned: number;
}

export function saveDraft(draft: GameFormDraft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch { /* storage full — ignore */ }
}

export function loadDraft(): GameFormDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Auto-saves form state to sessionStorage on changes (debounced).
 * Only active when NOT editing an existing game.
 */
export function useGameFormAutosave(
  isEditing: boolean,
  getState: () => GameFormDraft
) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const save = useCallback(() => {
    if (isEditing) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveDraft(getState());
    }, 500);
  }, [isEditing, getState]);

  // Clean up timer on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return save;
}
