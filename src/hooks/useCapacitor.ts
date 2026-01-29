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

export function useCapacitor() {
  const [state, setState] = useState<CapacitorState>({
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
    isOnline: true,
    connectionType: null,
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

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

// Hook for managing the active library in mobile context
export function useMobileLibrary() {
  const [activeLibrary, setActiveLibrary] = useState<string | null>(null);
  const { isNative } = useCapacitor();

  useEffect(() => {
    if (!isNative) return;

    // Load saved library on mount
    MobileStorage.get<string>('activeLibrary').then(slug => {
      if (slug) setActiveLibrary(slug);
    });
  }, [isNative]);

  const selectLibrary = useCallback(async (slug: string) => {
    setActiveLibrary(slug);
    await MobileStorage.set('activeLibrary', slug);
  }, []);

  const clearLibrary = useCallback(async () => {
    setActiveLibrary(null);
    await MobileStorage.remove('activeLibrary');
  }, []);

  return { activeLibrary, selectLibrary, clearLibrary };
}
