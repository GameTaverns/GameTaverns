import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, apiClient, isSelfHostedMode } from "@/integrations/backend/client";
import { useAuth } from "./useAuth";
import { Library, LibrarySettings } from "@/contexts/TenantContext";

// Hook to get current user's library
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
        .single();
      
      if (error && error.code !== "PGRST116") {
        throw error;
      }
      
      return data as Library | null;
    },
    enabled: isAuthenticated && !!user,
  });
}

// Hook to get library settings
export function useLibrarySettings(libraryId: string | null) {
  return useQuery({
    queryKey: ["library-settings", libraryId],
    queryFn: async () => {
      if (!libraryId) return null;
      
      const { data, error } = await supabase
        .from("library_settings")
        .select("*")
        .eq("library_id", libraryId)
        .single();
      
      if (error) throw error;
      return data as LibrarySettings;
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
    },
  });
}

// Hook to update library settings
export function useUpdateLibrarySettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      libraryId, 
      updates 
    }: { 
      libraryId: string; 
      updates: Partial<LibrarySettings>;
    }) => {
      const { data, error } = await supabase
        .from("library_settings")
        .update(updates)
        .eq("library_id", libraryId)
        .select()
        .single();
      
      if (error) throw error;
      return data as LibrarySettings;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["library-settings", data.library_id] });
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
          };
        }
      }
      
      // Supabase mode
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") {
        throw error;
      }
      
      return data;
    },
    enabled: isAuthenticated && !!user,
    // Retry once on error for transient failures
    retry: 1,
    // Allow stale data for 5 minutes
    staleTime: 5 * 60 * 1000,
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
      bio?: string | null;
      username?: string | null;
    }) => {
      if (!user) throw new Error("Must be logged in");
      
      // Self-hosted: use API
      if (isSelfHostedMode()) {
        const profile = await apiClient.put<any>("/profiles/me", updates);
        return profile;
      }
      
      // Supabase mode
      const { data, error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}
