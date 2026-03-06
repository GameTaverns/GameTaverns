import { useState, useCallback } from "react";

/**
 * Persists the active tab in sessionStorage so it survives
 * browser-tab switches and re-renders.
 *
 * @param storageKey unique key per page/component
 * @param defaultValue the tab shown on first visit
 */
export function usePersistedTab(storageKey: string, defaultValue: string) {
  const [tab, setTabState] = useState<string>(() => {
    try {
      return sessionStorage.getItem(storageKey) || defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setTab = useCallback(
    (value: string) => {
      setTabState(value);
      try {
        sessionStorage.setItem(storageKey, value);
      } catch {
        // storage full or blocked – silently ignore
      }
    },
    [storageKey],
  );

  return [tab, setTab] as const;
}
