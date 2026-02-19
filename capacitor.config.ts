import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e6868cccab20485baaa3d3345575c037',
  appName: 'GameTaverns',
  webDir: 'dist',
  server: {
    url: 'https://gametaverns.com',
    cleartext: true
  },
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
