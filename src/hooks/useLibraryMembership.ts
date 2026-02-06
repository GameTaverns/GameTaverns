import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSelfHostedSupabaseStack } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export interface LibraryMember {
  id: string;
  library_id: string;
  user_id: string;
  role: 'member' | 'moderator' | 'owner';
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

  // Get member count for a library (includes owner)
  const { data: memberCount } = useQuery({
    queryKey: ["library-member-count", libraryId],
    queryFn: async () => {
      if (!libraryId) return 0;
      
      // Count explicit members
      const { count, error } = await supabase
        .from("library_members")
        .select("*", { count: "exact", head: true })
        .eq("library_id", libraryId);
      
      if (error) throw error;
      
      // Add 1 for the owner (owner is always counted)
      return (count || 0) + 1;
    },
    enabled: !!libraryId,
  });

  // Join a library
  const joinLibrary = useMutation({
    mutationFn: async () => {
      if (!libraryId || !user?.id) throw new Error("Missing library or user");
      
      if (isSelfHostedSupabaseStack()) {
        // Self-hosted Supabase stack: use backend function (service role) to avoid RLS edge cases
        const { data, error } = await supabase.functions.invoke("membership", {
          body: { action: "join", libraryId },
        });
        if (error) throw error;
        return data;
      }
      
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
      
      if (isSelfHostedSupabaseStack()) {
        // Self-hosted Supabase stack: use backend function
        const { error } = await supabase.functions.invoke("membership", {
          body: { action: "leave", libraryId },
        });
        if (error) throw error;
        return;
      }
      
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
// Includes both explicit members from library_members AND the owner
export function useLibraryMembers(libraryId: string | undefined) {
  return useQuery({
    queryKey: ["library-members", libraryId],
    queryFn: async () => {
      if (!libraryId) return [];
      
      // Fetch explicit members (without join - no FK relationship)
      const { data: members, error: membersError } = await supabase
        .from("library_members")
        .select("*")
        .eq("library_id", libraryId)
        .order("joined_at", { ascending: false });
      
      if (membersError) throw membersError;
      
      // Fetch the library to get owner info
      const { data: library, error: libraryError } = await supabase
        .from("libraries")
        .select("owner_id, created_at")
        .eq("id", libraryId)
        .single();
      
      if (libraryError) throw libraryError;
      
      // Collect all user IDs we need profiles for
      const userIds = (members || []).map(m => m.user_id);
      if (library.owner_id && !userIds.includes(library.owner_id)) {
        userIds.push(library.owner_id);
      }
      
      // Fetch all profiles in one query
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, username")
        .in("user_id", userIds);
      
      // Create a map for quick lookup
      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, { display_name: p.display_name, username: p.username }])
      );
      
      // Build result with profiles attached
      const result: Array<{
        id: string;
        library_id: string;
        user_id: string;
        role: string;
        joined_at: string;
        user_profiles: { display_name?: string; username?: string } | null;
      }> = [];
      
      // Check if owner is already in members list
      const ownerInMembers = members?.some(m => m.user_id === library.owner_id);
      
      // Add owner first if not already a member
      if (!ownerInMembers && library.owner_id) {
        result.push({
          id: `owner-${library.owner_id}`,
          library_id: libraryId,
          user_id: library.owner_id,
          role: "owner",
          joined_at: library.created_at,
          user_profiles: profileMap.get(library.owner_id) || null,
        });
      }
      
      // Add all members with their profiles
      for (const member of members || []) {
        result.push({
          ...member,
          user_profiles: profileMap.get(member.user_id) || null,
        });
      }
      
      return result;
    },
    enabled: !!libraryId,
    refetchOnMount: "always",
  });
}

// Type for membership with library info
export interface MembershipWithLibrary {
  id: string;
  role: 'member' | 'moderator' | 'owner';
  joined_at: string;
  library: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  } | null;
}

// Hook to get all libraries/communities the current user is a member of (including owned)
export function useMyMemberships() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: async (): Promise<MembershipWithLibrary[]> => {
      if (!user?.id) return [];
      
      // Fetch memberships
      const { data: memberships, error: membershipsError } = await supabase
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
      
      if (membershipsError) throw membershipsError;
      
      // Fetch owned library
      const { data: ownedLibrary, error: ownedError } = await supabase
        .from("libraries")
        .select("id, name, slug, description, created_at")
        .eq("owner_id", user.id)
        .maybeSingle();
      
      if (ownedError) throw ownedError;
      
      // Combine: owned library first (as "owner" role), then memberships
      const results: MembershipWithLibrary[] = [];
      
      if (ownedLibrary) {
        // Check if the owned library isn't already in memberships
        const alreadyMember = memberships?.some(m => m.library?.id === ownedLibrary.id);
        if (!alreadyMember) {
          results.push({
            id: `owned-${ownedLibrary.id}`,
            role: 'owner',
            joined_at: ownedLibrary.created_at,
            library: {
              id: ownedLibrary.id,
              name: ownedLibrary.name,
              slug: ownedLibrary.slug,
              description: ownedLibrary.description,
            },
          });
        }
      }
      
      // Add regular memberships (cast role to our union type)
      if (memberships) {
        for (const m of memberships) {
          results.push({
            id: m.id,
            role: m.role as 'member' | 'moderator',
            joined_at: m.joined_at,
            library: m.library as MembershipWithLibrary['library'],
          });
        }
      }
      
      return results;
    },
    enabled: !!user?.id,
  });
}
