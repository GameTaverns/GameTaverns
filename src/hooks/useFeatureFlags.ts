import { useMemo } from "react";
import { useSiteSettings } from "./useSiteSettings";
import { useDemoMode } from "@/contexts/DemoContext";

/**
 * Feature Flags System
 * 
 * Priority: ENV VARS (deploy-time) → Admin Settings (runtime) → Defaults
 * 
 * ENV VARS (set at deploy time):
 * - VITE_FEATURE_PLAY_LOGS=false → disables at deploy time
 * - VITE_FEATURE_WISHLIST=false → disables at deploy time
 * - etc.
 * 
 * Admin can override at runtime via site_settings unless ENV explicitly set to "false"
 */

export interface FeatureFlags {
  playLogs: boolean;
  wishlist: boolean;
  forSale: boolean;
  messaging: boolean;
  comingSoon: boolean;
  demoMode: boolean;
}

// Default values when nothing is configured
const DEFAULT_FLAGS: FeatureFlags = {
  playLogs: true,
  wishlist: true,
  forSale: true,
  messaging: true,
  comingSoon: true,
  demoMode: true,
};

// Get env var value, returns undefined if not set
function getEnvFlag(key: string): boolean | undefined {
  const value = import.meta.env[key];
  if (value === undefined || value === "") return undefined;
  return value === "true";
}

// Get env-level overrides (deploy-time settings)
function getEnvFlags(): Partial<FeatureFlags> {
  const flags: Partial<FeatureFlags> = {};
  
  const playLogs = getEnvFlag("VITE_FEATURE_PLAY_LOGS");
  if (playLogs !== undefined) flags.playLogs = playLogs;
  
  const wishlist = getEnvFlag("VITE_FEATURE_WISHLIST");
  if (wishlist !== undefined) flags.wishlist = wishlist;
  
  const forSale = getEnvFlag("VITE_FEATURE_FOR_SALE");
  if (forSale !== undefined) flags.forSale = forSale;
  
  const messaging = getEnvFlag("VITE_FEATURE_MESSAGING");
  if (messaging !== undefined) flags.messaging = messaging;
  
  const comingSoon = getEnvFlag("VITE_FEATURE_COMING_SOON");
  if (comingSoon !== undefined) flags.comingSoon = comingSoon;
  
  const demoMode = getEnvFlag("VITE_FEATURE_DEMO_MODE");
  if (demoMode !== undefined) flags.demoMode = demoMode;
  
  return flags;
}

// Hook for accessing feature flags
export function useFeatureFlags(): FeatureFlags & { isLoading: boolean } {
  const { data: siteSettings, isLoading } = useSiteSettings();
  const { isDemoMode, demoFeatureFlags } = useDemoMode();
  
  const flags = useMemo(() => {
    // In demo mode, use demo-specific feature flags (demoMode flag is always true in demo)
    if (isDemoMode && demoFeatureFlags) {
      return {
        ...demoFeatureFlags,
        demoMode: true, // Always true when already in demo mode
      };
    }
    
    // Start with defaults
    const result = { ...DEFAULT_FLAGS };
    
    // Apply admin settings (from database)
    if (siteSettings) {
      const dbPlayLogs = (siteSettings as Record<string, string | undefined>).feature_play_logs;
      const dbWishlist = (siteSettings as Record<string, string | undefined>).feature_wishlist;
      const dbForSale = (siteSettings as Record<string, string | undefined>).feature_for_sale;
      const dbMessaging = (siteSettings as Record<string, string | undefined>).feature_messaging;
      const dbComingSoon = (siteSettings as Record<string, string | undefined>).feature_coming_soon;
      const dbDemoMode = (siteSettings as Record<string, string | undefined>).feature_demo_mode;
      
      if (dbPlayLogs !== undefined) result.playLogs = dbPlayLogs === "true";
      if (dbWishlist !== undefined) result.wishlist = dbWishlist === "true";
      if (dbForSale !== undefined) result.forSale = dbForSale === "true";
      if (dbMessaging !== undefined) result.messaging = dbMessaging === "true";
      if (dbComingSoon !== undefined) result.comingSoon = dbComingSoon === "true";
      if (dbDemoMode !== undefined) result.demoMode = dbDemoMode === "true";
    }
    
    // Apply ENV overrides last (they take precedence)
    const envFlags = getEnvFlags();
    Object.assign(result, envFlags);
    
    return result;
  }, [siteSettings, isDemoMode, demoFeatureFlags]);
  
  return { ...flags, isLoading };
}

// Export flag names for admin UI
export const FEATURE_FLAG_LABELS: Record<keyof FeatureFlags, string> = {
  playLogs: "Play Logs",
  wishlist: "Wishlist / Voting",
  forSale: "For Sale",
  messaging: "Messaging",
  comingSoon: "Coming Soon",
  demoMode: "Demo Mode",
};

export const FEATURE_FLAG_DESCRIPTIONS: Record<keyof FeatureFlags, string> = {
  playLogs: "Track game sessions and play history",
  wishlist: "Allow guests to vote for games they want to play",
  forSale: "Show games that are for sale with pricing",
  messaging: "Allow visitors to send messages about games",
  comingSoon: "Show upcoming games that aren't available yet",
  demoMode: "Allow visitors to access the demo environment",
};
