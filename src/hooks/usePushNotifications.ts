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
  debugLog: string[];
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
    debugLog: [],
  });

  const addDebug = useCallback((msg: string) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log('PUSH_DEBUG:', entry);
    setState(prev => ({ ...prev, debugLog: [...prev.debugLog.slice(-19), entry] }));
  }, []);

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
    const avail = isPushPluginAvailable();
    addDebug(`Plugin available: ${avail}, platform: ${Capacitor.getPlatform()}`);
    if (avail) {
      setState(prev => ({ ...prev, isSupported: true }));
    }
  }, [addDebug]);

  /**
   * Register with FCM/APNs with retry-with-backoff.
   * The native bridge can be unstable right after the OS permission dialog
   * closes, so we retry up to 3 times with increasing delays.
   */
  const registerForPush = useCallback(async (): Promise<boolean> => {
    if (!isPushPluginAvailable()) { addDebug('register: plugin not available'); return false; }
    if (isRegisteringRef.current) {
      addDebug('register: already in progress, skipping');
      return false;
    }

    try {
      const permissions = await PushNotifications.checkPermissions();
      addDebug(`register: permissions.receive = ${permissions.receive}`);
      if (permissions.receive !== 'granted') {
        return false;
      }
    } catch (e) {
      addDebug(`register: checkPermissions error: ${e}`);
      return false;
    }

    isRegisteringRef.current = true;
    const MAX_RETRIES = 3;
    const BACKOFF_MS = [1000, 2000, 4000];

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        addDebug(`register: attempt ${attempt + 1}/${MAX_RETRIES}`);
        await PushNotifications.register();
        addDebug('register: SUCCESS');
        isRegisteringRef.current = false;
        return true;
      } catch (registerError) {
        addDebug(`register: attempt ${attempt + 1} FAILED: ${registerError}`);
        if (attempt < MAX_RETRIES - 1) {
          await wait(BACKOFF_MS[attempt]);
        }
      }
    }

    addDebug('register: ALL attempts failed');
    isRegisteringRef.current = false;
    return false;
  }, [addDebug]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isPushPluginAvailable()) { addDebug('reqPerm: plugin not available'); return false; }
    isRequestingPermissionRef.current = true;

    try {
      addDebug('reqPerm: requesting permissions...');
      const permission = await PushNotifications.requestPermissions();
      addDebug(`reqPerm: result = ${permission.receive}`);

      if (permission.receive === 'granted') {
        addDebug('reqPerm: waiting 4s for stabilization...');
        await wait(4000);
        isRequestingPermissionRef.current = false;
        const result = await registerForPush();
        addDebug(`reqPerm: registerForPush returned ${result}`);
        return result;
      }

      isRequestingPermissionRef.current = false;
      return false;
    } catch (error) {
      isRequestingPermissionRef.current = false;
      addDebug(`reqPerm: ERROR: ${error}`);
      return false;
    }
  }, [registerForPush, addDebug]);

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
          addDebug(`TOKEN RECEIVED: ${token.value?.substring(0, 20)}...`);
          setState(prev => ({
            ...prev,
            isRegistered: true,
            token: token.value,
          }));

          try {
            await MobileStorage.set('pushToken', token.value);
            addDebug('Token stored locally');
          } catch (e) {
            addDebug(`Local store FAILED: ${e}`);
          }

          try {
            await upsertPushToken(token.value);
            addDebug('Token upserted to DB');
          } catch (e) {
            addDebug(`DB upsert FAILED: ${e}`);
          }
        });

        // Registration error
        await PushNotifications.addListener('registrationError', (error) => {
          addDebug(`REGISTRATION ERROR: ${JSON.stringify(error)}`);
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
            addDebug(`Found stored token: ${storedToken.substring(0, 20)}...`);
            setState(prev => ({
              ...prev,
              isRegistered: true,
              token: storedToken,
            }));
            upsertPushToken(storedToken).catch((e) => addDebug(`Re-upsert failed: ${e}`));
          } else {
            addDebug('No stored token, checking permissions...');
            try {
              const perms = await PushNotifications.checkPermissions();
              addDebug(`Init permissions: ${perms.receive}`);
              if (perms.receive === 'granted') {
                await wait(1000);
                registerForPush().catch((e) => addDebug(`Auto-register failed: ${e}`));
              }
            } catch (e) {
              addDebug(`Init checkPermissions error: ${e}`);
            }
          }
        } catch (e) {
          addDebug(`Read stored token error: ${e}`);
        }

      } catch (e) {
        addDebug(`Listener setup FAILED: ${e}`);
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
  }, [registerForPush, addDebug]);

  const clearNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [] }));
  }, []);

  return {
    ...state,
    requestPermission,
    clearNotifications,
  };
}
