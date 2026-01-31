import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, apiClient, isSelfHostedMode } from "@/integrations/backend/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Shield, User, UserCog, Ban, UserCheck, Mail, Clock, AlertTriangle, Crown, Star, Library } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

// 5-Tier Role Hierarchy
type AppRole = "admin" | "staff" | "owner" | "moderator" | null;

interface UserWithDetails {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: AppRole;
  is_banned: boolean;
  banned_until: string | null;
  is_library_owner?: boolean; // Flag to indicate user owns at least one library
}

// Get tier number for role comparison (lower = more privileged)
function getRoleTier(role: AppRole): number {
  switch (role) {
    case "admin": return 1;
    case "staff": return 2;
    case "owner": return 3;
    case "moderator": return 4;
    default: return 5;
  }
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; user: UserWithDetails | null }>({ open: false, user: null });
  const [suspendDuration, setSuspendDuration] = useState<string>("7d");
  const [suspendReason, setSuspendReason] = useState("");

  // Get current user's role
  const { data: currentUserRole } = useQuery({
    queryKey: ["current-user-role", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      return data?.role as AppRole || null;
    },
    enabled: !!currentUser?.id,
  });

  // Fetch users via edge function (Cloud) or API (self-hosted)
  const { data: users, isLoading, isError, error } = useQuery({
    queryKey: ["admin-users-full"],
    queryFn: async () => {
      if (isSelfHostedMode()) {
        // Self-hosted: use Express API
        const data = await apiClient.get<any[]>("/admin/users");
        // Transform to expected format
        return data.map((u: any) => ({
          id: u.id,
          email: u.email,
          display_name: u.display_name || null,
          username: u.username || null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at || null,
          role: u.roles?.[0] || null,
          is_banned: u.is_banned || false,
          banned_until: u.banned_until || null,
        })) as UserWithDetails[];
      }
      
      // Cloud: use edge function
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });

      if (error) throw error;
      return data.users as UserWithDetails[];
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole | "none" }) => {
      setUpdatingUserId(userId);

      // Get the target user's current role
      const targetUser = users?.find(u => u.id === userId);
      const targetCurrentRole = targetUser?.role || null;
      
      // Get current user's tier
      const currentTier = getRoleTier(currentUserRole);
      const targetCurrentTier = getRoleTier(targetCurrentRole);
      const targetNewTier = newRole === "none" ? 5 : getRoleTier(newRole as AppRole);
      
      // Security: Can't modify users at same or higher tier (unless you're admin)
      if (currentUserRole !== "admin") {
        if (targetCurrentTier <= currentTier) {
          throw new Error(`Cannot modify users at your tier or above`);
        }
        // Can't promote to same or higher tier than yourself
        if (targetNewTier <= currentTier) {
          throw new Error(`Cannot promote users to your tier or above`);
        }
      }
      
      // Always delete all existing roles first to avoid duplicates
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      
      if (deleteError) throw deleteError;
      
      // Insert new role if not "none"
      if (newRole !== "none") {
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-full"] });
      toast.success("User role updated");
    },
    onError: (error) => {
      console.error("Failed to update role:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update user role");
    },
    onSettled: () => {
      setUpdatingUserId(null);
    },
  });

  // Suspend user mutation
  const suspendMutation = useMutation({
    mutationFn: async ({ userId, duration, reason }: { userId: string; duration: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "suspend", userId, duration, reason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-full"] });
      toast.success("User suspended");
      setSuspendDialog({ open: false, user: null });
      setSuspendReason("");
    },
    onError: (error) => {
      console.error("Failed to suspend user:", error);
      toast.error("Failed to suspend user");
    },
  });

  // Unsuspend user mutation
  const unsuspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "unsuspend", userId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-full"] });
      toast.success("User unsuspended");
    },
    onError: (error) => {
      console.error("Failed to unsuspend user:", error);
      toast.error("Failed to unsuspend user");
    },
  });

  const getRoleBadge = (role: AppRole, isLibraryOwner?: boolean) => {
    const libraryIndicator = isLibraryOwner ? (
      <span className="ml-1" title="Has library">
        <Library className="w-3 h-3 inline text-amber-400" />
      </span>
    ) : null;
    
    switch (role) {
      case "admin":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30"><Crown className="w-3 h-3 mr-1" />Admin{libraryIndicator}</Badge>;
      case "staff":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><Shield className="w-3 h-3 mr-1" />Staff{libraryIndicator}</Badge>;
      case "owner":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Star className="w-3 h-3 mr-1" />Owner{libraryIndicator}</Badge>;
      case "moderator":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><UserCog className="w-3 h-3 mr-1" />Moderator{libraryIndicator}</Badge>;
      default:
        return <Badge variant="outline" className="text-cream/50">User{libraryIndicator}</Badge>;
    }
  };

  // Determine which roles the current user can assign
  const getAvailableRoles = (targetUser: UserWithDetails) => {
    const currentTier = getRoleTier(currentUserRole);
    const targetTier = getRoleTier(targetUser.role);
    
    // Can't modify yourself
    if (targetUser.id === currentUser?.id) return [];
    
    // Only admin can manage other admins or staff
    if (currentUserRole !== "admin" && targetTier <= currentTier) return [];
    
    const allRoles: { value: string; label: string; tier: number }[] = [
      { value: "none", label: "User (Tier 5)", tier: 5 },
      { value: "moderator", label: "Moderator (Tier 4)", tier: 4 },
      { value: "owner", label: "Owner (Tier 3)", tier: 3 },
      { value: "staff", label: "Staff (Tier 2)", tier: 2 },
      { value: "admin", label: "Admin (Tier 1)", tier: 1 },
    ];
    
    // Filter: only show roles at lower privilege than current user (higher tier number)
    // Admin can assign any role
    if (currentUserRole === "admin") {
      return allRoles;
    }
    
    return allRoles.filter(r => r.tier > currentTier);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
        <div className="font-semibold">Failed to load users</div>
        <div className="mt-1 text-muted-foreground">
          {(error as Error)?.message || "Unknown error"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Role Legend - 5 Tier System */}
      <div className="bg-wood-medium/20 rounded-lg p-4 border border-wood-medium/30">
        <h4 className="font-semibold text-cream mb-3">Role Hierarchy (5 Tiers)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
          <div className="flex items-start gap-2 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <Crown className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-cream font-medium">T1: Admin</span>
              <p className="text-cream/60 text-xs mt-1">Super-admin with full platform control</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <Shield className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-cream font-medium">T2: Staff</span>
              <p className="text-cream/60 text-xs mt-1">Site staff with elevated privileges</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <Star className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-cream font-medium">T3: Owner</span>
              <p className="text-cream/60 text-xs mt-1">Library owners with dashboard access</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <UserCog className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-cream font-medium">T4: Moderator</span>
              <p className="text-cream/60 text-xs mt-1">Community mods (polls, events, users)</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-wood-medium/30 rounded-lg border border-wood-medium/40">
            <User className="w-4 h-4 text-cream/60 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-cream font-medium">T5: User</span>
              <p className="text-cream/60 text-xs mt-1">Regular community members</p>
            </div>
          </div>
        </div>
        <p className="text-cream/50 text-xs mt-3 italic">
          Note: T4 Moderators have limited abilities within their assigned communities (run polls, remove users, set up events).
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-cream">All Users ({users?.length || 0})</h3>
        <Badge variant="outline" className="text-cream/70">
          Your role: {getRoleBadge(currentUserRole)}
        </Badge>
      </div>

      <div className="rounded-lg border border-wood-medium/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-wood-medium/30 hover:bg-wood-medium/40">
              <TableHead className="text-cream/70">User</TableHead>
              <TableHead className="text-cream/70">Email</TableHead>
              <TableHead className="text-cream/70">Joined</TableHead>
              <TableHead className="text-cream/70">Last Active</TableHead>
              <TableHead className="text-cream/70">Status</TableHead>
              <TableHead className="text-cream/70">Role</TableHead>
              <TableHead className="text-cream/70">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => {
              const availableRoles = getAvailableRoles(user);
              const canModify = availableRoles.length > 0;
              
              return (
                <TableRow key={user.id} className="border-wood-medium/30 hover:bg-wood-medium/20">
                  <TableCell className="text-cream">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-wood-medium flex items-center justify-center">
                        <User className="w-4 h-4 text-cream/70" />
                      </div>
                      <div>
                        <div className="font-medium">{user.display_name || "Unknown"}</div>
                        {user.username && (
                          <div className="text-xs text-cream/50">@{user.username}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-cream/80">
                      <Mail className="w-3.5 h-3.5 text-cream/50" />
                      <span className="text-sm">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-cream/70 text-sm">
                    {format(new Date(user.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-cream/70 text-sm">
                    {user.last_sign_in_at ? (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-cream/50" />
                        {formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })}
                      </div>
                    ) : (
                      <span className="text-cream/40">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.is_banned ? (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <Ban className="w-3 h-3 mr-1" />
                        Suspended
                      </Badge>
                    ) : (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <UserCheck className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role, user.is_library_owner)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {canModify ? (
                        <Select
                          value={user.role || "none"}
                          onValueChange={(value) => 
                            updateRoleMutation.mutate({ 
                              userId: user.id, 
                              newRole: value === "none" ? "none" : value as AppRole
                            })
                          }
                          disabled={updatingUserId === user.id}
                        >
                          <SelectTrigger className="w-32 h-8 bg-wood-medium/30 border-wood-medium/50 text-cream text-xs">
                            {updatingUserId === user.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent className="bg-sidebar border-wood-medium/50">
                            {availableRoles.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-cream/40 italic">
                          {user.id === currentUser?.id ? "Self" : "Protected"}
                        </span>
                      )}
                      
                      {user.is_banned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-green-500/30 text-green-400 hover:bg-green-500/20"
                          onClick={() => unsuspendMutation.mutate(user.id)}
                          disabled={unsuspendMutation.isPending}
                        >
                          {unsuspendMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3 mr-1" />
                              Unsuspend
                            </>
                          )}
                        </Button>
                      ) : user.id !== currentUser?.id && canModify ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/20"
                          onClick={() => setSuspendDialog({ open: true, user })}
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          Suspend
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {(!users || users.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-cream/50 py-8">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Suspend User Dialog */}
      <Dialog open={suspendDialog.open} onOpenChange={(open) => !open && setSuspendDialog({ open: false, user: null })}>
        <DialogContent className="bg-sidebar border-wood-medium/50">
          <DialogHeader>
            <DialogTitle className="text-cream flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Suspend User
            </DialogTitle>
            <DialogDescription className="text-cream/70">
              Suspend <span className="font-medium text-cream">{suspendDialog.user?.display_name || suspendDialog.user?.email}</span> from accessing the platform.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-cream/80">Duration</Label>
              <Select value={suspendDuration} onValueChange={setSuspendDuration}>
                <SelectTrigger className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 Days</SelectItem>
                  <SelectItem value="30d">30 Days</SelectItem>
                  <SelectItem value="90d">90 Days</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-cream/80">Reason (optional)</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Enter reason for suspension..."
                className="bg-wood-medium/30 border-wood-medium/50 text-cream placeholder:text-cream/40"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuspendDialog({ open: false, user: null })}
              className="border-wood-medium/50 text-cream"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => suspendDialog.user && suspendMutation.mutate({ 
                userId: suspendDialog.user.id, 
                duration: suspendDuration,
                reason: suspendReason 
              })}
              disabled={suspendMutation.isPending}
            >
              {suspendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              Suspend User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
