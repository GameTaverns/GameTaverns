import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gametaverns.app',
  appName: 'GameTaverns',
  webDir: 'dist',
  // Bundled mode: UI assets are packaged inside the APK.
  // The runtime override in src/config/runtime.ts forces all API calls to
  // https://gametaverns.com when Capacitor.isNativePlatform() is true.
  // No server.url here — that would switch to live-reload WebView mode.
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'GameTaverns',
    // Info.plist overrides required by App Store
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'GameTaverns needs access to your photo library to let you upload profile pictures and game images.',
      NSCameraUsageDescription: 'GameTaverns needs access to your camera to let you take photos of games and your collection.',
    },
  },
  // Android-specific configuration
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: '#1a1510',
      showSpinner: false,
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
