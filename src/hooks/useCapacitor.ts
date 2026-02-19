import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network, ConnectionStatus } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

interface CapacitorState {
  isNative: boolean;
  platform: 'ios' | 'android' | 'web';
  isOnline: boolean;
  connectionType: string | null;
}

/**
 * Reliable native detection that works from frame 0, before the Capacitor bridge fires.
 * Android bundled APK and iOS bundled IPA both run on hostname "localhost".
 * No Lovable/web hostname is ever "localhost" in production.
 */
function detectIsNative(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') return true;
  }
  return false;
}

export function useCapacitor() {
  const [state, setState] = useState<CapacitorState>({
    isNative: detectIsNative(),
    platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
    isOnline: true,
    connectionType: null,
  });

  useEffect(() => {
    if (!detectIsNative()) return;

    // Initialize native features
    const initNative = async () => {
      // Check initial network status
      const status = await Network.getStatus();
      setState(prev => ({
        ...prev,
        isOnline: status.connected,
        connectionType: status.connectionType,
      }));

      // Configure status bar for dark theme
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#1a1510' });
      } catch (e) {
        console.log('StatusBar not available:', e);
      }

      // Hide splash screen after app is ready
      await SplashScreen.hide();
    };

    initNative();

    // Listen for network changes
    const networkListener = Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
      setState(prev => ({
        ...prev,
        isOnline: status.connected,
        connectionType: status.connectionType,
      }));
    });

    return () => {
      networkListener.then(handle => handle.remove());
    };
  }, []);

  return state;
}

// Persistent storage utilities for offline support
export const MobileStorage = {
  async set(key: string, value: unknown): Promise<void> {
    await Preferences.set({
      key,
      value: JSON.stringify(value),
    });
  },

  async get<T>(key: string): Promise<T | null> {
    const { value } = await Preferences.get({ key });
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  },

  async clear(): Promise<void> {
    await Preferences.clear();
  },
};

// Hook for managing the active library in mobile context.
// IMPORTANT: We do NOT persist the activeLibrary across cold starts.
// Every fresh app launch shows the MobileLibrarySelector. The slug is only
// kept in React state for the current session (not saved to Preferences).
// This prevents the app from silently opening a stale tenant on launch.
export function useMobileLibrary() {
  const [activeLibrary, setActiveLibrary] = useState<string | null>(null);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false); // no async load needed

  useEffect(() => {
    if (!detectIsNative()) return;
    // Clear any previously persisted library so fresh launches always start clean
    MobileStorage.remove('activeLibrary').catch(() => {});
  }, []); // Run once on mount

  const selectLibrary = useCallback(async (slug: string) => {
    setActiveLibrary(slug);
    // Do NOT persist to storage — intentionally session-only
  }, []);

  const clearLibrary = useCallback(async () => {
    setActiveLibrary(null);
  }, []);

  return { activeLibrary, isLoadingLibrary, selectLibrary, clearLibrary };
}
