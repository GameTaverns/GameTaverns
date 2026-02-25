import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
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
    if (!Capacitor.isNativePlatform()) return;
    if (!Capacitor.isPluginAvailable('PushNotifications')) return;

    // Push notifications are now enabled on native platforms
    setState(prev => ({
      ...prev,
      isSupported: true,
    }));
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    if (!Capacitor.isPluginAvailable('PushNotifications')) return false;

    try {
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive === 'granted') {
        await PushNotifications.register();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting push notification permission:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!Capacitor.isPluginAvailable('PushNotifications')) return;

    let registrationListener: Promise<any> | null = null;
    let registrationErrorListener: Promise<any> | null = null;
    let notificationListener: Promise<any> | null = null;
    let actionListener: Promise<any> | null = null;

    try {
      // Registration success
      registrationListener = PushNotifications.addListener('registration', async (token: Token) => {
        console.log('Push registration success, token:', token.value);
        setState(prev => ({
          ...prev,
          isRegistered: true,
          token: token.value,
        }));

        // Save token to local storage
        try {
          await MobileStorage.set('pushToken', token.value);
        } catch (e) {
          console.warn('Failed to store push token locally:', e);
        }

        // Save token to database for server-side push delivery
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
            // Generic route navigation for DMs, notifications, etc.
            window.location.href = data.route;
          }
        }
      );

      // Check if already registered
      MobileStorage.get<string>('pushToken').then(token => {
        if (token) {
          setState(prev => ({
            ...prev,
            isRegistered: true,
            token,
          }));
          // Re-upsert on app launch to keep the token fresh
          upsertPushToken(token).catch(() => {});
        }
      }).catch(e => console.warn('Failed to read push token:', e));

    } catch (e) {
      console.warn('PushNotifications setup failed:', e);
    }

    return () => {
      try {
        registrationListener?.then(h => h?.remove()).catch(() => {});
        registrationErrorListener?.then(h => h?.remove()).catch(() => {});
        notificationListener?.then(h => h?.remove()).catch(() => {});
        actionListener?.then(h => h?.remove()).catch(() => {});
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
