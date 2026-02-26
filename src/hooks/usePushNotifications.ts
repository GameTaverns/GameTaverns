import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { MobileStorage } from './useCapacitor';
import { getLibraryUrl } from './useTenantUrl';
import { supabase } from '@/integrations/backend/client';

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

  const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

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
  }
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isRegistered: false,
    token: null,
    notifications: [],
  });

  useEffect(() => {
    try {
      if (!Capacitor.isNativePlatform()) return;
      // Use a safer check — isPluginAvailable can throw on some devices
      let pluginAvailable = false;
      try {
        pluginAvailable = Capacitor.isPluginAvailable('PushNotifications');
      } catch (_e) {
        console.warn('PushNotifications plugin check threw:', _e);
        return;
      }
      if (!pluginAvailable) return;

      setState(prev => ({
        ...prev,
        isSupported: true,
      }));
    } catch (e) {
      console.warn('PushNotifications availability check failed:', e);
    }
  }, []);

  const isRegisteringRef = useRef(false);
  const isRequestingPermissionRef = useRef(false);

  const registerForPush = useCallback(async (): Promise<boolean> => {
    try {
      if (!Capacitor.isNativePlatform()) return false;

      let pluginAvailable = false;
      try {
        pluginAvailable = Capacitor.isPluginAvailable('PushNotifications');
      } catch (_e) {
        return false;
      }
      if (!pluginAvailable) return false;
      if (isRegisteringRef.current) return false;

      const permissions = await PushNotifications.checkPermissions();
      if (permissions.receive !== 'granted') return false;

      isRegisteringRef.current = true;
      try {
        await PushNotifications.register();
        return true;
      } catch (registerError) {
        console.warn('PushNotifications.register() failed:', registerError);
        return false;
      } finally {
        isRegisteringRef.current = false;
      }
    } catch (error) {
      isRegisteringRef.current = false;
      console.warn('Error during push registration:', error);
      return false;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!Capacitor.isNativePlatform()) return false;

      let pluginAvailable = false;
      try {
        pluginAvailable = Capacitor.isPluginAvailable('PushNotifications');
      } catch (_e) {
        return false;
      }
      if (!pluginAvailable) return false;

      // Block appStateChange from triggering registration while OS dialog is up
      isRequestingPermissionRef.current = true;

      const permission = await PushNotifications.requestPermissions();

      if (permission.receive === 'granted') {
        // Longer delay: the app just resumed from the OS permission dialog.
        // The native bridge and Firebase need time to stabilize.
        setTimeout(() => {
          isRequestingPermissionRef.current = false;
          registerForPush().catch(() => {});
        }, 2500);
        return true;
      }

      isRequestingPermissionRef.current = false;
      return false;
    } catch (error) {
      isRequestingPermissionRef.current = false;
      console.warn('Error requesting push notification permission:', error);
      return false;
    }
  }, [registerForPush]);

  useEffect(() => {
    let cancelled = false;

    try {
      if (!Capacitor.isNativePlatform()) return;
      let pluginAvailable = false;
      try {
        pluginAvailable = Capacitor.isPluginAvailable('PushNotifications');
      } catch (_e) {
        console.warn('PushNotifications plugin check failed:', _e);
        return;
      }
      if (!pluginAvailable) return;
    } catch (e) {
      console.warn('PushNotifications plugin check failed:', e);
      return;
    }

    let registrationListener: Promise<any> | null = null;
    let registrationErrorListener: Promise<any> | null = null;
    let notificationListener: Promise<any> | null = null;
    let actionListener: Promise<any> | null = null;
    let appStateListener: Promise<any> | null = null;

    // Longer delay to let native bridge fully initialize
    const timer = setTimeout(() => {
      if (cancelled) return;

      try {
        // Registration success
        registrationListener = PushNotifications.addListener('registration', async (token: Token) => {
          console.log('Push registration success, token:', token.value);
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
        registrationErrorListener = PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
          setState(prev => ({
            ...prev,
            isRegistered: false,
            token: null,
          }));
        });

        // Notification received while app is in foreground
        notificationListener = PushNotifications.addListener(
          'pushNotificationReceived',
          (notification: PushNotificationSchema) => {
            console.log('Push notification received:', notification);
            setState(prev => ({
              ...prev,
              notifications: [...prev.notifications, notification],
            }));
          }
        );

        // Notification action performed (user tapped notification)
        actionListener = PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action: ActionPerformed) => {
            console.log('Push notification action performed:', action);
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

        // If user grants permission in system settings and returns to app,
        // retry registration once app becomes active again.
        // IMPORTANT: Skip if we're in the middle of requesting permissions —
        // the OS dialog causes an appStateChange cycle that would race with
        // the delayed registration in requestPermission().
        appStateListener = App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive || cancelled || isRequestingPermissionRef.current) return;
          // Extra delay to let native bridge stabilize after resume
          setTimeout(() => {
            if (cancelled || isRequestingPermissionRef.current) return;
            registerForPush().catch(() => {});
          }, 1500);
        });

        // Check if already registered
        MobileStorage.get<string>('pushToken').then(token => {
          if (token) {
            setState(prev => ({
              ...prev,
              isRegistered: true,
              token,
            }));
            upsertPushToken(token).catch(() => {});
            return;
          }

          registerForPush().catch(() => {});
        }).catch(e => console.warn('Failed to read push token:', e));

      } catch (e) {
        console.warn('PushNotifications listener setup failed:', e);
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      try {
        registrationListener?.then(h => h?.remove()).catch(() => {});
        registrationErrorListener?.then(h => h?.remove()).catch(() => {});
        notificationListener?.then(h => h?.remove()).catch(() => {});
        actionListener?.then(h => h?.remove()).catch(() => {});
        appStateListener?.then(h => h?.remove()).catch(() => {});
      } catch (e) {
        console.warn('PushNotifications cleanup failed:', e);
      }
    };
  }, []);

  const clearNotifications = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: [],
    }));
  }, []);

  return {
    ...state,
    requestPermission,
    clearNotifications,
  };
}
