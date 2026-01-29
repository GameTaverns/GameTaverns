import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { MobileStorage } from './useCapacitor';

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

    // Check if push notifications are supported
    setState(prev => ({
      ...prev,
      isSupported: Capacitor.isPluginAvailable('PushNotifications'),
    }));
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;

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

    // Registration success
    const registrationListener = PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Push registration success, token:', token.value);
      setState(prev => ({
        ...prev,
        isRegistered: true,
        token: token.value,
      }));

      // Store token for later use (e.g., sending to backend)
      await MobileStorage.set('pushToken', token.value);
    });

    // Registration error
    const registrationErrorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
      setState(prev => ({
        ...prev,
        isRegistered: false,
        token: null,
      }));
    });

    // Notification received while app is in foreground
    const notificationListener = PushNotifications.addListener(
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
    const actionListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('Push notification action performed:', action);
        // Handle deep linking based on notification data
        const data = action.notification.data;
        if (data?.librarySlug) {
          // Navigate to specific library
          window.location.href = `/?tenant=${data.librarySlug}`;
        }
        if (data?.gameSlug) {
          // Navigate to specific game
          window.location.href = `/?tenant=${data.librarySlug}&path=/games/${data.gameSlug}`;
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
    });

    return () => {
      registrationListener.then(h => h.remove());
      registrationErrorListener.then(h => h.remove());
      notificationListener.then(h => h.remove());
      actionListener.then(h => h.remove());
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
