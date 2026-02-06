import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSelfHostedSupabaseStack } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface LibraryDirectoryEntry {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  logo_url: string | null;
  is_discoverable: boolean;
  allow_lending: boolean;
  game_count: number;
  follower_count: number;
}

export interface LibraryFollower {
  id: string;
  library_id: string;
  follower_user_id: string;
  followed_at: string;
}

export function useLibraryDirectory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all discoverable libraries
  const { data: libraries = [], isLoading } = useQuery({
    queryKey: ["library-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_directory")
        .select("*")
        .order("follower_count", { ascending: false });

      if (error) throw error;
      return data as LibraryDirectoryEntry[];
    },
  });

  // Fetch libraries the current user follows
  const { data: following = [] } = useQuery({
    queryKey: ["library-following", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("library_followers")
        .select("library_id")
        .eq("follower_user_id", user.id);

      if (error) throw error;
      return data.map((f) => f.library_id);
    },
    enabled: !!user,
  });

  // Follow a library
  const followLibrary = useMutation({
    mutationFn: async (libraryId: string) => {
      if (!user) throw new Error("Must be logged in to follow");

       if (isSelfHostedSupabaseStack()) {
         // Self-hosted Supabase stack: use backend function
         const { data, error } = await supabase.functions.invoke("membership", {
           body: { action: "follow", libraryId },
         });
         if (error) throw error;
         return data;
       }

      const { data, error } = await supabase
        .from("library_followers")
        .insert({
          library_id: libraryId,
          follower_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Now following this library!");
      queryClient.invalidateQueries({ queryKey: ["library-directory"] });
      queryClient.invalidateQueries({ queryKey: ["library-following"] });
    },
    onError: (error) => {
      toast.error("Failed to follow: " + error.message);
    },
  });

  // Unfollow a library
  const unfollowLibrary = useMutation({
    mutationFn: async (libraryId: string) => {
      if (!user) throw new Error("Must be logged in to unfollow");

       if (isSelfHostedSupabaseStack()) {
         // Self-hosted Supabase stack: use backend function
         const { error } = await supabase.functions.invoke("membership", {
           body: { action: "unfollow", libraryId },
         });
         if (error) throw error;
         return;
       }

      const { error } = await supabase
        .from("library_followers")
        .delete()
        .eq("library_id", libraryId)
        .eq("follower_user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Unfollowed library");
      queryClient.invalidateQueries({ queryKey: ["library-directory"] });
      queryClient.invalidateQueries({ queryKey: ["library-following"] });
    },
    onError: (error) => {
      toast.error("Failed to unfollow: " + error.message);
    },
  });

  // Check if following a specific library
  const isFollowing = (libraryId: string): boolean => {
    return following.includes(libraryId);
  };

  // Toggle follow state
  const toggleFollow = (libraryId: string) => {
    if (isFollowing(libraryId)) {
      unfollowLibrary.mutate(libraryId);
    } else {
      followLibrary.mutate(libraryId);
    }
  };

  // Search/filter libraries
  const searchLibraries = (query: string): LibraryDirectoryEntry[] => {
    if (!query.trim()) return libraries;
    
    const lowerQuery = query.toLowerCase();
    return libraries.filter(
      (lib) =>
        lib.name.toLowerCase().includes(lowerQuery) ||
        lib.description?.toLowerCase().includes(lowerQuery)
    );
  };

  // Get libraries with lending enabled (explicitly check for true to handle null)
  const lendingLibraries = libraries.filter((lib) => lib.allow_lending === true);

  // Get popular libraries (top 10 by followers)
  const popularLibraries = [...libraries]
    .sort((a, b) => b.follower_count - a.follower_count)
    .slice(0, 10);

  // Get newest libraries
  const newestLibraries = [...libraries]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  return {
    libraries,
    following,
    isLoading,
    isFollowing,
    toggleFollow,
    followLibrary,
    unfollowLibrary,
    searchLibraries,
    lendingLibraries,
    popularLibraries,
    newestLibraries,
  };
}

// Hook to get follower count for a specific library
export function useLibraryFollowers(libraryId: string | undefined) {
  return useQuery({
    queryKey: ["library-followers", libraryId],
    queryFn: async () => {
      if (!libraryId) return { count: 0, followers: [] };

      const { count, error: countError } = await supabase
        .from("library_followers")
        .select("*", { count: "exact", head: true })
        .eq("library_id", libraryId);

      if (countError) throw countError;

      return { count: count || 0 };
    },
    enabled: !!libraryId,
  });
}
