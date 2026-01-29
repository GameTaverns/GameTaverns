import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export interface LibraryMember {
  id: string;
  library_id: string;
  user_id: string;
  role: 'member' | 'moderator';
  joined_at: string;
}

export function useLibraryMembership(libraryId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if current user is a member
  const { data: membership, isLoading: checkingMembership } = useQuery({
    queryKey: ["library-membership", libraryId, user?.id],
    queryFn: async () => {
      if (!libraryId || !user?.id) return null;
      
      const { data, error } = await supabase
        .from("library_members")
        .select("*")
        .eq("library_id", libraryId)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as LibraryMember | null;
    },
    enabled: !!libraryId && !!user?.id,
  });

  // Get member count for a library
  const { data: memberCount } = useQuery({
    queryKey: ["library-member-count", libraryId],
    queryFn: async () => {
      if (!libraryId) return 0;
      
      const { count, error } = await supabase
        .from("library_members")
        .select("*", { count: "exact", head: true })
        .eq("library_id", libraryId);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!libraryId,
  });

  // Join a library
  const joinLibrary = useMutation({
    mutationFn: async () => {
      if (!libraryId || !user?.id) throw new Error("Missing library or user");
      
      const { data, error } = await supabase
        .from("library_members")
        .insert({
          library_id: libraryId,
          user_id: user.id,
          role: "member",
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-membership", libraryId] });
      queryClient.invalidateQueries({ queryKey: ["library-member-count", libraryId] });
    },
  });

  // Leave a library
  const leaveLibrary = useMutation({
    mutationFn: async () => {
      if (!libraryId || !user?.id) throw new Error("Missing library or user");
      
      const { error } = await supabase
        .from("library_members")
        .delete()
        .eq("library_id", libraryId)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-membership", libraryId] });
      queryClient.invalidateQueries({ queryKey: ["library-member-count", libraryId] });
    },
  });

  return {
    membership,
    isMember: !!membership,
    memberRole: membership?.role,
    memberCount,
    checkingMembership,
    joinLibrary,
    leaveLibrary,
  };
}

// Hook to get all members of a library (for library owners/mods)
export function useLibraryMembers(libraryId: string | undefined) {
  return useQuery({
    queryKey: ["library-members", libraryId],
    queryFn: async () => {
      if (!libraryId) return [];
      
      const { data, error } = await supabase
        .from("library_members")
        .select(`
          *,
          user_profiles:user_id (
            display_name,
            username
          )
        `)
        .eq("library_id", libraryId)
        .order("joined_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!libraryId,
  });
}

// Hook to get all libraries/communities the current user is a member of
export function useMyMemberships() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("library_members")
        .select(`
          id,
          role,
          joined_at,
          library:library_id (
            id,
            name,
            slug,
            description
          )
        `)
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}
