import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Shield, User, UserCog } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface UserWithRole {
  user_id: string;
  display_name: string | null;
  created_at: string;
  role: "admin" | "moderator" | "user" | null;
}

export function UserManagement() {
  const queryClient = useQueryClient();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Fetch users with their profiles and roles
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Get all user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          user_id: profile.user_id,
          display_name: profile.display_name,
          created_at: profile.created_at,
          role: userRole?.role || null,
        };
      });

      return usersWithRoles;
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: "admin" | "moderator" | "user" | "none" }) => {
      setUpdatingUserId(userId);
      
      if (newRole === "none") {
        // Remove all roles
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        // Check if user already has a role
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingRole) {
          // Update existing role
          const { error } = await supabase
            .from("user_roles")
            .update({ role: newRole })
            .eq("user_id", userId);
          if (error) throw error;
        } else {
          // Insert new role
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: userId, role: newRole });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User role updated");
    },
    onError: (error) => {
      console.error("Failed to update role:", error);
      toast.error("Failed to update user role");
    },
    onSettled: () => {
      setUpdatingUserId(null);
    },
  });

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
      case "moderator":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><UserCog className="w-3 h-3 mr-1" />Moderator</Badge>;
      case "user":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><User className="w-3 h-3 mr-1" />User</Badge>;
      default:
        return <Badge variant="outline" className="text-cream/50">No Role</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-cream">All Users ({users?.length || 0})</h3>
      </div>

      <div className="rounded-lg border border-wood-medium/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-wood-medium/30 hover:bg-wood-medium/40">
              <TableHead className="text-cream/70">User</TableHead>
              <TableHead className="text-cream/70">Joined</TableHead>
              <TableHead className="text-cream/70">Current Role</TableHead>
              <TableHead className="text-cream/70">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.user_id} className="border-wood-medium/30 hover:bg-wood-medium/20">
                <TableCell className="text-cream">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-wood-medium flex items-center justify-center">
                      <User className="w-4 h-4 text-cream/70" />
                    </div>
                    <span>{user.display_name || "Unknown User"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-cream/70">
                  {format(new Date(user.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Select
                      value={user.role || "none"}
                      onValueChange={(value) => 
                        updateRoleMutation.mutate({ 
                          userId: user.user_id, 
                          newRole: value as "admin" | "moderator" | "user" | "none" 
                        })
                      }
                      disabled={updatingUserId === user.user_id}
                    >
                      <SelectTrigger className="w-32 bg-wood-medium/30 border-wood-medium/50 text-cream">
                        {updatingUserId === user.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Role</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!users || users.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-cream/50 py-8">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
