import { useMemo } from "react";
import { useSiteSettings } from "./useSiteSettings";
import { useDemoMode } from "@/contexts/DemoContext";
import { getRuntimeFeatureFlag, isProductionDeployment } from "@/config/runtime";

/**
 * Feature Flags System
 * 
 * Priority: Runtime Config (Cloudron) → ENV VARS (Vite) → Admin Settings → Defaults
 * 
 * Supports both Cloudron (window.__RUNTIME_CONFIG__) and Lovable/Vite (import.meta.env)
 */

export interface FeatureFlags {
  playLogs: boolean;
  wishlist: boolean;
  forSale: boolean;
  messaging: boolean;
  comingSoon: boolean;
  demoMode: boolean;
  ratings: boolean;
  events: boolean;
  achievements: boolean;
  lending: boolean;
}

// Default values when nothing is configured
// Note: demoMode is disabled by default in production deployments
const getDefaultFlags = (): FeatureFlags => ({
  playLogs: true,
  wishlist: true,
  forSale: true,
  messaging: true,
  comingSoon: true,
  demoMode: !isProductionDeployment(), // Disabled in production by default
  ratings: true,
  events: true,
  achievements: true,
  lending: true,
});

// Get flag from runtime config (Cloudron) or env var (Vite)
function getConfigFlag(runtimeKey: 'PLAY_LOGS' | 'WISHLIST' | 'FOR_SALE' | 'MESSAGING' | 'COMING_SOON' | 'DEMO_MODE' | 'RATINGS' | 'EVENTS' | 'ACHIEVEMENTS' | 'LENDING', envKey: string): boolean | undefined {
  // Check runtime config first (Cloudron)
  const runtimeValue = getRuntimeFeatureFlag(runtimeKey);
  if (runtimeValue !== undefined) return runtimeValue;
  
  // Fall back to Vite env
  const envValue = import.meta.env[envKey];
  if (envValue === undefined || envValue === "") return undefined;
  return envValue === "true";
}

// Get config-level overrides (runtime or deploy-time)
function getConfigFlags(): Partial<FeatureFlags> {
  const flags: Partial<FeatureFlags> = {};
  
  const playLogs = getConfigFlag("PLAY_LOGS", "VITE_FEATURE_PLAY_LOGS");
  if (playLogs !== undefined) flags.playLogs = playLogs;
  
  const wishlist = getConfigFlag("WISHLIST", "VITE_FEATURE_WISHLIST");
  if (wishlist !== undefined) flags.wishlist = wishlist;
  
  const forSale = getConfigFlag("FOR_SALE", "VITE_FEATURE_FOR_SALE");
  if (forSale !== undefined) flags.forSale = forSale;
  
  const messaging = getConfigFlag("MESSAGING", "VITE_FEATURE_MESSAGING");
  if (messaging !== undefined) flags.messaging = messaging;
  
  const comingSoon = getConfigFlag("COMING_SOON", "VITE_FEATURE_COMING_SOON");
  if (comingSoon !== undefined) flags.comingSoon = comingSoon;
  
  const demoMode = getConfigFlag("DEMO_MODE", "VITE_FEATURE_DEMO_MODE");
  if (demoMode !== undefined) flags.demoMode = demoMode;
  
  const ratings = getConfigFlag("RATINGS", "VITE_FEATURE_RATINGS");
  if (ratings !== undefined) flags.ratings = ratings;
  
  const events = getConfigFlag("EVENTS", "VITE_FEATURE_EVENTS");
  if (events !== undefined) flags.events = events;
  
  const achievements = getConfigFlag("ACHIEVEMENTS", "VITE_FEATURE_ACHIEVEMENTS");
  if (achievements !== undefined) flags.achievements = achievements;
  
  const lending = getConfigFlag("LENDING", "VITE_FEATURE_LENDING");
  if (lending !== undefined) flags.lending = lending;
  
  return flags;
}

// Hook for accessing feature flags
export function useFeatureFlags(): FeatureFlags & { isLoading: boolean } {
  const { data: siteSettings, isLoading } = useSiteSettings();
  const { isDemoMode, demoFeatureFlags } = useDemoMode();
  
  const flags = useMemo(() => {
    const defaultFlags = getDefaultFlags();
    
    // In demo mode, use demo-specific feature flags (demoMode flag is always true in demo)
    if (isDemoMode && demoFeatureFlags) {
      return {
        ...defaultFlags, // Start with defaults to ensure all flags exist
        ...demoFeatureFlags,
        demoMode: true, // Always true when already in demo mode
      };
    }
    
    // Start with defaults
    const result = { ...defaultFlags };
    
    // Apply admin settings (from database)
    if (siteSettings) {
      const dbPlayLogs = (siteSettings as Record<string, string | undefined>).feature_play_logs;
      const dbWishlist = (siteSettings as Record<string, string | undefined>).feature_wishlist;
      const dbForSale = (siteSettings as Record<string, string | undefined>).feature_for_sale;
      const dbMessaging = (siteSettings as Record<string, string | undefined>).feature_messaging;
      const dbComingSoon = (siteSettings as Record<string, string | undefined>).feature_coming_soon;
      const dbDemoMode = (siteSettings as Record<string, string | undefined>).feature_demo_mode;
      const dbRatings = (siteSettings as Record<string, string | undefined>).feature_ratings;
      const dbEvents = (siteSettings as Record<string, string | undefined>).feature_events;
      const dbAchievements = (siteSettings as Record<string, string | undefined>).feature_achievements;
      const dbLending = (siteSettings as Record<string, string | undefined>).feature_lending;
      
      if (dbPlayLogs !== undefined) result.playLogs = dbPlayLogs === "true";
      if (dbWishlist !== undefined) result.wishlist = dbWishlist === "true";
      if (dbForSale !== undefined) result.forSale = dbForSale === "true";
      if (dbMessaging !== undefined) result.messaging = dbMessaging === "true";
      if (dbComingSoon !== undefined) result.comingSoon = dbComingSoon === "true";
      if (dbDemoMode !== undefined) result.demoMode = dbDemoMode === "true";
      if (dbRatings !== undefined) result.ratings = dbRatings === "true";
      if (dbEvents !== undefined) result.events = dbEvents === "true";
      if (dbAchievements !== undefined) result.achievements = dbAchievements === "true";
      if (dbLending !== undefined) result.lending = dbLending === "true";
    }
    
    // Apply config overrides last (they take precedence)
    const configFlags = getConfigFlags();
    Object.assign(result, configFlags);
    
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
  ratings: "Ratings",
  events: "Events Calendar",
  achievements: "Achievements",
  lending: "Game Lending",
};

export const FEATURE_FLAG_DESCRIPTIONS: Record<keyof FeatureFlags, string> = {
  playLogs: "Track game sessions and play history",
  wishlist: "Allow guests to vote for games they want to play",
  forSale: "Show games that are for sale with pricing",
  messaging: "Allow visitors to send messages about games",
  comingSoon: "Show upcoming games that aren't available yet",
  demoMode: "Allow visitors to access the demo environment",
  ratings: "Allow visitors to rate games (5-star system)",
  events: "Show upcoming events and calendar to visitors",
  achievements: "Show achievements and badges for library engagement",
  lending: "Allow registered users to request game loans",
};
