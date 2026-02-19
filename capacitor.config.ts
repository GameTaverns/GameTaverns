import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gametaverns.app',
  appName: 'GameTaverns',
  webDir: 'dist',
  // Bundled mode: UI assets are packaged inside the APK.
  // The app calls https://gametaverns.com for all data/auth via VITE env vars.
  // Do NOT add server.url here — that switches to WebView mode (just a browser).
  // iOS-specific configuration
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'GameTaverns',
  },
  // Android-specific configuration
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#1a1510',
      showSpinner: true,
      spinnerColor: '#e67e22',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#1a1510',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
