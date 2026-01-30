import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export interface Library {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  // Not present in public view (libraries_public)
  owner_id?: string;
  is_active: boolean;
  is_premium: boolean;
  custom_domain: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibrarySettings {
  id: string;
  library_id: string;
  // Theme - light mode
  theme_primary_h: string;
  theme_primary_s: string;
  theme_primary_l: string;
  theme_accent_h: string;
  theme_accent_s: string;
  theme_accent_l: string;
  theme_background_h: string;
  theme_background_s: string;
  theme_background_l: string;
  theme_card_h: string;
  theme_card_s: string;
  theme_card_l: string;
  theme_sidebar_h: string;
  theme_sidebar_s: string;
  theme_sidebar_l: string;
  // Theme - dark mode
  theme_dark_primary_h: string;
  theme_dark_primary_s: string;
  theme_dark_primary_l: string;
  theme_dark_accent_h: string;
  theme_dark_accent_s: string;
  theme_dark_accent_l: string;
  theme_dark_background_h: string;
  theme_dark_background_s: string;
  theme_dark_background_l: string;
  theme_dark_card_h: string;
  theme_dark_card_s: string;
  theme_dark_card_l: string;
  theme_dark_sidebar_h: string;
  theme_dark_sidebar_s: string;
  theme_dark_sidebar_l: string;
  // Typography
  theme_font_display: string;
  theme_font_body: string;
  // Background
  background_image_url: string | null;
  background_overlay_opacity: string;
  // Logo
  logo_url: string | null;
  // Features
  feature_play_logs: boolean;
  feature_wishlist: boolean;
  feature_for_sale: boolean;
  feature_messaging: boolean;
  feature_coming_soon: boolean;
  feature_ratings: boolean;
  feature_events: boolean;
  feature_achievements: boolean;
  feature_lending: boolean;
  // Content (turnstile_site_key excluded from public view for security)
  turnstile_site_key?: string | null;
  footer_text: string | null;
  twitter_handle: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  discord_url: string | null;
  contact_email: string | null;
}

interface TenantContextType {
  // Current tenant state
  library: Library | null;
  settings: LibrarySettings | null;
  isLoading: boolean;
  error: string | null;
  
  // Suspension state
  isSuspended: boolean;
  suspendedLibraryName: string | null;
  suspensionReason: string | null;
  
  // Mode detection
  isTenantMode: boolean;  // Are we viewing a library?
  isAdminMode: boolean;   // Is this /admin path (owner controls)?
  isOwner: boolean;       // Is the logged-in user the library owner?
  
  // Platform mode (no tenant)
  isPlatformMode: boolean; // Are we on the main gametaverns.com?
  
  // Testing
  tenantSlug: string | null; // Current tenant slug (for debugging)
  
  // Actions
  refreshLibrary: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  children: React.ReactNode;
}

/**
 * Resolves tenant from:
 * 1. ?tenant=slug query param (for Lovable preview testing)
 * 2. Subdomain: library.gametaverns.com → 'library'
 * 3. Custom domain (future)
 */
function resolveTenantSlug(): string | null {
  // Check query param first (for testing in Lovable preview)
  const params = new URLSearchParams(window.location.search);
  const tenantParam = params.get("tenant");
  if (tenantParam) {
    return tenantParam.toLowerCase();
  }
  
  // Check subdomain
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  
  // Skip for localhost and preview domains
  if (
    hostname === "localhost" ||
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".lovableproject.com")
  ) {
    return null;
  }
  
  let slug: string | null = null;
  
  // Production domain: library.gametaverns.com (3 parts)
  if (hostname.endsWith(".gametaverns.com")) {
    if (parts.length === 3) {
      slug = parts[0];
    }
  }
  
  // Skip reserved subdomains
  if (slug && ["www", "api", "mail", "admin", "tavern"].includes(slug)) {
    return null;
  }
  
  return slug?.toLowerCase() || null;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  
  // Resolve tenant slug early to determine if we need to load
  const tenantSlugEarly = useMemo(() => resolveTenantSlug(), [location.search]);
  
  const [library, setLibrary] = useState<Library | null>(null);
  const [settings, setSettings] = useState<LibrarySettings | null>(null);
  // Start as NOT loading if there's no tenant - platform mode renders immediately
  const [isLoading, setIsLoading] = useState(!!tenantSlugEarly);
  const [error, setError] = useState<string | null>(null);
  
  // Suspension state
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendedLibraryName, setSuspendedLibraryName] = useState<string | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);
  
  // Use the early-resolved tenant slug
  const tenantSlug = tenantSlugEarly;
  
  // Check if we're on an admin path
  const isAdminMode = location.pathname.includes("/admin");
  
  // Determine modes
  const isTenantMode = !!tenantSlug || !!library;
  const isPlatformMode = !isTenantMode;
  
  // Check if current user is owner
  const isOwner = useMemo(() => {
    if (!library || !user) return false;
    return library.owner_id === user.id;
  }, [library, user]);
  
  // Fetch library data
  const fetchLibrary = async () => {
    if (!tenantSlug) {
      setLibrary(null);
      setSettings(null);
      setIsSuspended(false);
      setSuspendedLibraryName(null);
      setSuspensionReason(null);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setIsSuspended(false);
    setSuspendedLibraryName(null);
    setSuspensionReason(null);
    
    try {
      // Fetch library by slug.
      // IMPORTANT: Signed-out visitors must use the public view (avoids private columns + permission issues).
      // NOTE: We intentionally load the base library record from the public view first,
      // then (only when authenticated) fetch owner_id from the private table.
      const { data: libraryData, error: libraryError } = await supabase
        .from("libraries_public")
        .select("*")
        .eq("slug", tenantSlug)
        .single();
      
      if (libraryError || !libraryData) {
        setError("Library not found");
        setLibrary(null);
        setSettings(null);
        setIsLoading(false);
        return;
      }
      
      // Check if library is suspended (inactive)
      if (!libraryData.is_active) {
        // For signed-out visitors we can't read suspension reasons (private), so show a generic message.
        const suspensionData = isAuthenticated
          ? (
              await supabase
                .from("library_suspensions")
                .select("reason")
                .eq("library_id", libraryData.id)
                .eq("action", "suspended")
                .order("created_at", { ascending: false })
                .limit(1)
                .single()
            ).data
          : null;
        
        setIsSuspended(true);
        setSuspendedLibraryName(libraryData.name);
        setSuspensionReason(suspensionData?.reason || null);
        setLibrary(null);
        setSettings(null);
        setIsLoading(false);
        return;
      }
      
      // Attach owner_id for authenticated users only (prevents leaking owner_id to anonymous visitors)
      let ownerId: string | undefined = undefined;
      if (isAuthenticated) {
        const { data: ownerRow, error: ownerErr } = await supabase
          .from("libraries")
          .select("owner_id")
          .eq("id", libraryData.id)
          .single();

        if (!ownerErr && ownerRow?.owner_id) {
          ownerId = ownerRow.owner_id;
        }
      }

      setLibrary({ ...(libraryData as Library), owner_id: ownerId } as Library);
      
      // Fetch library settings using public view (accessible to all users including anonymous)
      const { data: settingsData, error: settingsError } = await supabase
        .from("library_settings_public")
        .select("*")
        .eq("library_id", libraryData.id)
        .single();
      
      if (!settingsError && settingsData) {
        setSettings(settingsData as LibrarySettings);
      } else if (settingsError) {
        console.warn("[Tenant] Failed to load public library settings", settingsError);
      }
    } catch (err) {
      console.error("Error fetching library:", err);
      setError("Failed to load library");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load library on mount and when slug or auth state changes
  useEffect(() => {
    fetchLibrary();
  }, [tenantSlug, isAuthenticated]);
  
  const value: TenantContextType = {
    library,
    settings,
    isLoading,
    error,
    isSuspended,
    suspendedLibraryName,
    suspensionReason,
    isTenantMode,
    isAdminMode,
    isOwner,
    isPlatformMode,
    tenantSlug,
    refreshLibrary: fetchLibrary,
  };
  
  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

export function useTenantSettings() {
  const { settings } = useTenant();
  return settings;
}

export function useIsLibraryOwner() {
  const { isOwner } = useTenant();
  return isOwner;
}
