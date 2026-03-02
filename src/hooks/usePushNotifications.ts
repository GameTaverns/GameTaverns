import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { MobileStorage } from './useCapacitor';
import { getLibraryUrl } from './useTenantUrl';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';

interface PushNotificationState {
  isSupported: boolean;
  isRegistered: boolean;
  token: string | null;
  notifications: PushNotificationSchema[];
}

/** Save or update the push token in the database */
async function upsertPushToken(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const platform = Capacitor.getPlatform();

  const { error } = await supabase
    .from('user_push_tokens')
    .upsert(
      {
        user_id: user.id,
        token,
        platform,
        device_info: { capacitor_platform: platform },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );

  if (error) {
    console.warn('Failed to upsert push token:', error);
  } else {
    console.log('Push token upserted successfully for user:', user.id);
  }
}

/** Check if PushNotifications plugin is available without throwing */
function isPushPluginAvailable(): boolean {
  try {
    if (!Capacitor.isNativePlatform()) return false;
    return Capacitor.isPluginAvailable('PushNotifications');
  } catch {
    return false;
  }
}

/** Wait for a given number of milliseconds */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isRegistered: false,
    token: null,
    notifications: [],
  });

  const isRegisteringRef = useRef(false);
  const isRequestingPermissionRef = useRef(false);
  const listenersSetupRef = useRef(false);

  // When the user authenticates, re-upsert the stored push token.
  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) return;
    MobileStorage.get<string>('pushToken').then(token => {
      if (token) {
        console.log('Re-upserting push token after auth for user:', user.id);
        upsertPushToken(token).catch(e => console.warn('Post-auth token upsert failed:', e));
      }
    }).catch(() => {});
  }, [user?.id]);

  // Check plugin availability on mount
  useEffect(() => {
    if (isPushPluginAvailable()) {
      setState(prev => ({ ...prev, isSupported: true }));
    }
  }, []);

  /**
   * Register with FCM/APNs with retry-with-backoff.
   * The native bridge can be unstable right after the OS permission dialog
   * closes, so we retry up to 3 times with increasing delays.
   */
  const registerForPush = useCallback(async (): Promise<boolean> => {
    if (!isPushPluginAvailable()) return false;
    if (isRegisteringRef.current) {
      console.log('Push registration already in progress, skipping');
      return false;
    }

    try {
      const permissions = await PushNotifications.checkPermissions();
      if (permissions.receive !== 'granted') {
        console.log('Push permission not granted, skipping registration');
        return false;
      }
    } catch (e) {
      console.warn('checkPermissions failed:', e);
      return false;
    }

    isRegisteringRef.current = true;

    const MAX_RETRIES = 3;
    const BACKOFF_MS = [1000, 2000, 4000]; // 1s, 2s, 4s

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`Push register attempt ${attempt + 1}/${MAX_RETRIES}`);
        await PushNotifications.register();
        console.log('PushNotifications.register() succeeded');
        isRegisteringRef.current = false;
        return true;
      } catch (registerError) {
        console.warn(`PushNotifications.register() attempt ${attempt + 1} failed:`, registerError);
        if (attempt < MAX_RETRIES - 1) {
          console.log(`Waiting ${BACKOFF_MS[attempt]}ms before retry...`);
          await wait(BACKOFF_MS[attempt]);
        }
      }
    }

    console.warn('All push register attempts failed');
    isRegisteringRef.current = false;
    return false;
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isPushPluginAvailable()) return false;

    // Block appStateChange from triggering registration while OS dialog is up
    isRequestingPermissionRef.current = true;

    try {
      console.log('Requesting push notification permissions...');
      const permission = await PushNotifications.requestPermissions();
      console.log('Push permission result:', permission.receive);

      if (permission.receive === 'granted') {
        // Much longer delay after OS dialog: Firebase needs time to fully
        // reinitialize after the app comes back from the permission flow.
        // 4 seconds has been tested to prevent crashes on slower devices.
        console.log('Permission granted, waiting 4s for native bridge stabilization...');
        await wait(4000);
        isRequestingPermissionRef.current = false;

        const result = await registerForPush();
        return result;
      }

      isRequestingPermissionRef.current = false;
      return false;
    } catch (error) {
      isRequestingPermissionRef.current = false;
      console.warn('Error requesting push notification permission:', error);
      return false;
    }
  }, [registerForPush]);

  // Setup listeners once
  useEffect(() => {
    if (!isPushPluginAvailable()) return;
    if (listenersSetupRef.current) return;

    let cancelled = false;

    // Delay listener setup to let native bridge fully initialize
    const timer = setTimeout(async () => {
      if (cancelled) return;

      try {
        // Remove any stale listeners before adding new ones
        try {
          await PushNotifications.removeAllListeners();
          console.log('Cleared previous push listeners');
        } catch (e) {
          console.warn('removeAllListeners failed (non-fatal):', e);
        }

        listenersSetupRef.current = true;

        // Registration success
        await PushNotifications.addListener('registration', async (token: Token) => {
          console.log('Push registration success, token:', token.value?.substring(0, 20) + '...');
          setState(prev => ({
            ...prev,
            isRegistered: true,
            token: token.value,
          }));

          try {
            await MobileStorage.set('pushToken', token.value);
          } catch (e) {
            console.warn('Failed to store push token locally:', e);
          }

          try {
            await upsertPushToken(token.value);
          } catch (e) {
            console.warn('Failed to save push token to database:', e);
          }
        });

        // Registration error
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', JSON.stringify(error));
          setState(prev => ({
            ...prev,
            isRegistered: false,
            token: null,
          }));
        });

        // Notification received while app is in foreground
        await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification: PushNotificationSchema) => {
            console.log('Push notification received:', notification.title);
            setState(prev => ({
              ...prev,
              notifications: [...prev.notifications, notification],
            }));
          }
        );

        // Notification action performed (user tapped notification)
        await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action: ActionPerformed) => {
            console.log('Push notification action performed');
            const data = action.notification.data;
            if (data?.gameSlug && data?.librarySlug) {
              window.location.href = getLibraryUrl(data.librarySlug, `/games/${data.gameSlug}`);
            } else if (data?.librarySlug) {
              window.location.href = getLibraryUrl(data.librarySlug, "/");
            } else if (data?.route) {
              window.location.href = data.route;
            }
          }
        );

        // Re-register when app comes back to foreground (e.g., user enabled
        // notifications in system settings). Skip if permission dialog is open.
        App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive || cancelled || isRequestingPermissionRef.current) return;
          // Long delay to prevent crash on resume
          setTimeout(() => {
            if (cancelled || isRequestingPermissionRef.current) return;
            registerForPush().catch(() => {});
          }, 3000);
        });

        // Check if already registered from a previous session
        try {
          const storedToken = await MobileStorage.get<string>('pushToken');
          if (storedToken) {
            console.log('Found stored push token, marking as registered');
            setState(prev => ({
              ...prev,
              isRegistered: true,
              token: storedToken,
            }));
            upsertPushToken(storedToken).catch(() => {});
          } else {
            // Only auto-register if permission was previously granted
            try {
              const perms = await PushNotifications.checkPermissions();
              if (perms.receive === 'granted') {
                console.log('Permission already granted, registering...');
                await wait(1000); // Extra delay for safety
                registerForPush().catch(() => {});
              }
            } catch (e) {
              console.warn('checkPermissions during init failed:', e);
            }
          }
        } catch (e) {
          console.warn('Failed to read stored push token:', e);
        }

      } catch (e) {
        console.warn('PushNotifications listener setup failed:', e);
        listenersSetupRef.current = false;
      }
    }, 3000); // 3s delay for initial setup (up from 2s)

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (listenersSetupRef.current) {
        try {
          PushNotifications.removeAllListeners().catch(() => {});
        } catch {}
        listenersSetupRef.current = false;
      }
    };
  }, [registerForPush]);

  const clearNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [] }));
  }, []);

  return {
    ...state,
    requestPermission,
    clearNotifications,
  };
}
