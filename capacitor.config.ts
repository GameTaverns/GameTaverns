import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e6868cccab20485baaa3d3345575c037',
  appName: 'GameTaverns',
  webDir: 'dist',
  server: {
    // Lovable preview — switch to https://gametaverns.com once fixes are deployed to production
    url: 'https://e6868ccc-ab20-485b-aaa3-d3345575c037.lovableproject.com?forceHideBadge=true',
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
