import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  apiClient,
  isSelfHostedMode,
  isSelfHostedSupabaseStack,
} from "@/integrations/backend/client";
import { useAuth } from "./useAuth";
import { Library, LibrarySettings } from "@/contexts/TenantContext";

// Hook to get current user's first library (legacy – kept for backward compat)
// Now returns the oldest library (first created) so creating a 2nd doesn't hide the original.
export function useMyLibrary() {
  const { user, isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: ["my-library", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Self-hosted: prefer /profiles/me which already returns owned libraries
      if (isSelfHostedMode()) {
        const me = await apiClient.get<{ libraries?: Library[] }>("/profiles/me");
        return (me.libraries?.[0] as Library | undefined) ?? null;
      }
      
      const { data, error } = await supabase
        .from("libraries")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") {
        throw error;
      }
      
      return data as Library | null;
    },
    enabled: isAuthenticated && !!user,
  });
}

// Hook to get ALL libraries owned by the current user
export function useMyLibraries() {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["my-libraries", user?.id],
    queryFn: async () => {
      if (!user) return [];

      if (isSelfHostedMode()) {
        const me = await apiClient.get<{ libraries?: Library[] }>("/profiles/me");
        return (me.libraries ?? []) as Library[];
      }

      const { data, error } = await supabase
        .from("libraries")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Library[];
    },
    enabled: isAuthenticated && !!user,
  });
}

// Hook to get the platform max-libraries-per-user setting
export function useMaxLibrariesPerUser() {
  return useQuery({
    queryKey: ["max-libraries-per-user"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "max_libraries_per_user")
        .maybeSingle();

      if (error) return 1; // default to 1
      const parsed = parseInt(data?.value || "1", 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to get library settings
export function useLibrarySettings(libraryId: string | null) {
  return useQuery({
    queryKey: ["library-settings", libraryId],
    queryFn: async () => {
      if (!libraryId) return null;
      
      // Self-hosted: use API endpoint
      if (isSelfHostedMode()) {
        try {
          return await apiClient.get<LibrarySettings>(`/library-settings/${libraryId}`);
        } catch (e) {
          // Settings may not exist yet
          return null;
        }
      }
      
      const { data, error } = await supabase
        .from("library_settings")
        .select("*")
        .eq("library_id", libraryId)
        .maybeSingle();
      
      if (error) throw error;
      return data as LibrarySettings | null;
    },
    enabled: !!libraryId,
  });
}

// Hook to check if a slug is available
export function useSlugAvailability(slug: string) {
  return useQuery({
    queryKey: ["slug-availability", slug],
    queryFn: async () => {
      if (!slug || slug.length < 3) return { available: false, reason: "Slug must be at least 3 characters" };
      
      // Validate format
      const slugRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
      if (!slugRegex.test(slug)) {
        return { 
          available: false, 
          reason: "Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only" 
        };
      }
      
      // Check reserved slugs
      const reserved = ["admin", "api", "www", "app", "help", "support", "docs", "blog", "status", "platform", "demo"];
      if (reserved.includes(slug)) {
        return { available: false, reason: "This name is reserved" };
      }
      
      // Check database
      const { data, error } = await supabase
        .from("libraries")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      
      if (error) throw error;
      
      return { 
        available: !data, 
        reason: data ? "This library name is already taken" : null 
      };
    },
    enabled: slug.length >= 3,
  });
}

// Hook to create a new library
export function useCreateLibrary() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ slug, name, description }: { slug: string; name: string; description?: string }) => {
      if (!user) throw new Error("Must be logged in");
      
      const { data, error } = await supabase
        .from("libraries")
        .insert({
          owner_id: user.id,
          slug: slug.toLowerCase(),
          name,
          description,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Library;
    },
    onSuccess: (data) => {
      // Set the data directly in the cache for immediate availability
      queryClient.setQueryData(["my-library", data.owner_id], data);
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["my-library"] });
      queryClient.invalidateQueries({ queryKey: ["my-libraries"] });
    },
  });
}

// Hook to update library settings
export function useUpdateLibrarySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      libraryId,
      updates,
    }: {
      libraryId: string;
      updates: Partial<LibrarySettings>;
    }) => {
      // Legacy self-hosted (Express API): use API endpoint
      if (isSelfHostedMode()) {
        await apiClient.put<{ success: boolean; library_id: string }>(
          `/library-settings/${libraryId}`,
          updates
        );
        return { ...updates, library_id: libraryId } as LibrarySettings;
      }

      // Self-hosted Supabase stack: route through backend function to avoid RLS/JWT/GUC edge cases
      // while still enforcing ownership checks server-side.
      if (isSelfHostedSupabaseStack()) {
        const { data, error } = await supabase.functions.invoke("library-settings", {
          method: "PUT",
          body: { libraryId, ...updates },
        });

        if (error) throw error;
        const payload: any = data;
        return (payload?.data ?? payload) as LibrarySettings;
      }

      // Cloud mode: upsert so we don't fail if the settings row doesn't exist yet
      const { data, error } = await supabase
        .from("library_settings")
        .upsert({ library_id: libraryId, ...updates } as any, {
          onConflict: "library_id",
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error(
          "No settings row was returned. This can happen if your database rejected the upsert (RLS/JWT config) or the settings table isn't reachable."
        );
      }

      return data as LibrarySettings;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["library-settings", variables.libraryId] });
    },
  });
}

// Hook to update library info
export function useUpdateLibrary() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      libraryId, 
      updates 
    }: { 
      libraryId: string; 
      updates: Partial<Pick<Library, "name" | "description">>;
    }) => {
      const { data, error } = await supabase
        .from("libraries")
        .update(updates)
        .eq("id", libraryId)
        .select()
        .single();
      
      if (error) throw error;
      return data as Library;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-library"] });
    },
  });
}

// Hook to get user profile
export function useUserProfile() {
  const { user, isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      // Self-hosted: use API
      if (isSelfHostedMode()) {
        try {
          const profile = await apiClient.get<{
            id: string;
            user_id: string;
            display_name: string | null;
            username: string | null;
            avatar_url: string | null;
            bio: string | null;
            created_at: string;
            roles?: string[];
            libraries?: any[];
            email?: string;
            featured_achievement_id?: string | null;
            featured_achievement?: {
              id: string;
              name: string;
              icon: string | null;
              tier: number;
            } | null;
          }>("/profiles/me");
          return profile;
        } catch (error) {
          console.error("[useUserProfile] API error:", error);
          // Fallback to user metadata stored by AuthContext
          const metadata = (user as any)?.user_metadata;
          return {
            id: user.id,
            user_id: user.id,
            display_name: metadata?.display_name || null,
            username: metadata?.username || null,
            avatar_url: metadata?.avatar_url || null,
            bio: null,
            created_at: new Date().toISOString(),
            featured_achievement_id: null as string | null,
            featured_achievement: null as { id: string; name: string; icon: string | null; tier: number } | null,
          };
        }
      }

      // Self-hosted Supabase stack: avoid embedded relationship syntax (causes 400 on older PostgREST)
      // Fetch profile and achievement separately, then merge
      if (isSelfHostedSupabaseStack()) {
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError && profileError.code !== "PGRST116") {
          throw profileError;
        }

        if (!profile) return null;

        // Fetch featured achievement separately if set
        let featured_achievement = null;
        if (profile.featured_achievement_id) {
          const { data: achievement } = await supabase
            .from("achievements")
            .select("id, name, icon, tier")
            .eq("id", profile.featured_achievement_id)
            .maybeSingle();
          featured_achievement = achievement;
        }

        return { ...profile, featured_achievement };
      }
      
      // Cloud mode: use embedded relationship syntax (works reliably)
      const { data, error } = await supabase
        .from("user_profiles")
        .select(
          `*,
           featured_achievement:achievements(
             id,
             name,
             icon,
             tier
           )`
        )
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") {
        throw error;
      }
      
      return data;
    },
    enabled: isAuthenticated && !!user,
    // Retry once on error for transient failures
    retry: 1,
  });
}

// Hook to update user profile
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (updates: { 
      display_name?: string | null; 
      avatar_url?: string | null; 
      banner_url?: string | null;
      bio?: string | null;
      username?: string | null;
      featured_achievement_id?: string | null;
      // Profile theme fields
      profile_primary_h?: string | null;
      profile_primary_s?: string | null;
      profile_primary_l?: string | null;
      profile_accent_h?: string | null;
      profile_accent_s?: string | null;
      profile_accent_l?: string | null;
      profile_background_h?: string | null;
      profile_background_s?: string | null;
      profile_background_l?: string | null;
      profile_bg_image_url?: string | null;
      profile_bg_opacity?: string | null;
      [key: string]: any;
    }) => {
      if (!user) throw new Error("Must be logged in");

      console.log("[updateProfile] mode check — selfHosted:", isSelfHostedMode(), "selfHostedSupabase:", isSelfHostedSupabaseStack());
      console.log("[updateProfile] updates:", JSON.stringify(updates));
      
      // Self-hosted Express API: use API endpoint
      if (isSelfHostedMode()) {
        const profile = await apiClient.put<any>("/profiles/me", updates);
        console.log("[updateProfile] API result:", profile);
        return profile;
      }
      
      // Self-hosted Supabase stack: route through edge function to bypass PostgREST schema cache
      if (isSelfHostedSupabaseStack()) {
        console.log("[updateProfile] invoking profile-update edge function");
        const { data, error } = await supabase.functions.invoke("profile-update", {
          method: "POST",
          body: updates,
        });
        console.log("[updateProfile] edge function result:", data, error);
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
      }
      
      // Cloud mode: direct PostgREST update
      console.log("[updateProfile] cloud direct update for user:", user.id);
      const { data, error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();
      
      console.log("[updateProfile] cloud result:", data, error);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log("[updateProfile] onSuccess, invalidating queries. data:", data);
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      // Also invalidate the public profile cache so changes appear immediately
      queryClient.invalidateQueries({ queryKey: ["public-profile"] });
    },
    onError: (error) => {
      console.error("[updateProfile] mutation error:", error);
    },
  });
}
