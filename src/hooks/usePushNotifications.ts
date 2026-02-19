import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { MobileStorage } from './useCapacitor';
import { getLibraryUrl } from './useTenantUrl';

interface PushNotificationState {
  isSupported: boolean;
  isRegistered: boolean;
  token: string | null;
  notifications: PushNotificationSchema[];
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
    // Push notifications require Firebase (google-services.json) to be configured.
    // Until a Firebase project is set up, keep isSupported=false to prevent a
    // fatal native crash when PushNotificationsPlugin.register() calls
    // FirebaseApp.getInstance() on an uninitialized Firebase app.
    // To enable: add google-services.json to android/app/ and set isSupported below.
    setState(prev => ({
      ...prev,
      isSupported: false, // disabled until Firebase is configured
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
    // Guard: only proceed if the plugin is actually available
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
        try {
          await MobileStorage.set('pushToken', token.value);
        } catch (e) {
          console.warn('Failed to store push token:', e);
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
