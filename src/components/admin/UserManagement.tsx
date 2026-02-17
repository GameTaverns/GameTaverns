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
import { Input } from "@/components/ui/input";
import { Loader2, Shield, User, UserCog, Ban, UserCheck, Mail, Clock, AlertTriangle, Crown, Star, Library, Trash2, MailCheck, RefreshCw, Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

// 5-Tier Role Hierarchy
type AppRole = "admin" | "staff" | "owner" | "moderator" | null;
type SortField = "display_name" | "email" | "created_at" | "last_sign_in_at" | "status" | "role";
type SortDir = "asc" | "desc";

interface UserWithDetails {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  role: AppRole;
  is_banned: boolean;
  banned_until: string | null;
  is_library_owner?: boolean; // Flag to indicate user owns at least one library
  is_library_moderator?: boolean; // Flag to indicate user is a moderator in at least one library
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
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: UserWithDetails | null }>({ open: false, user: null });
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [suspendDuration, setSuspendDuration] = useState<string>("7d");
  const [suspendReason, setSuspendReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const USERS_PER_PAGE = 25;

  // Get current user's role
  const { data: currentUserRole } = useQuery({
    queryKey: ["current-user-role", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      
      if (isSelfHostedMode()) {
        // Self-hosted: get role from /auth/me endpoint which includes roles array
        try {
          const data = await apiClient.get<{ roles: string[] }>("/auth/me");
          // Return the first (highest) role, or null
          return (data.roles?.[0] as AppRole) || null;
        } catch {
          return null;
        }
      }
      
      // Cloud: use Supabase
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
          email_confirmed_at: u.email_confirmed_at || null,
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

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (isSelfHostedMode()) {
        await apiClient.delete(`/admin/users/${userId}`);
        return { success: true };
      }
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", userId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-full"] });
     queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      toast.success("User deleted permanently");
      setDeleteDialog({ open: false, user: null });
      setDeleteConfirmText("");
    },
    onError: (error) => {
      console.error("Failed to delete user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    },
  });

  // Resend confirmation email mutation
  const resendConfirmationMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (isSelfHostedMode()) {
        await apiClient.post("/admin/resend-confirmation", { userId });
        return { success: true };
      }
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "resend_confirmation", userId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Confirmation email resent");
    },
    onError: (error) => {
      console.error("Failed to resend confirmation:", error);
      toast.error(error instanceof Error ? error.message : "Failed to resend confirmation email");
    },
  });

  const getRoleBadge = (role: AppRole, isLibraryOwner?: boolean) => {
    // Library ownership indicator (amber Library icon)
    const libraryIndicator = isLibraryOwner && role !== "owner" ? (
      <span className="ml-1" title="Owns a library">
        <Library className="w-3 h-3 inline text-amber-400" />
      </span>
    ) : null;
    
    switch (role) {
      case "admin":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30"><Crown className="w-3 h-3 mr-1" />Admin{libraryIndicator}</Badge>;
      case "staff":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><Shield className="w-3 h-3 mr-1" />Staff{libraryIndicator}</Badge>;
      case "owner":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Star className="w-3 h-3 mr-1" />Owner</Badge>;
      case "moderator":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><UserCog className="w-3 h-3 mr-1" />Moderator (T4){libraryIndicator}</Badge>;
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

      {/* Search + Header */}
      {(() => {
        const filteredUsers = (users || []).filter(u => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return (
            u.email?.toLowerCase().includes(q) ||
            u.display_name?.toLowerCase().includes(q) ||
            u.username?.toLowerCase().includes(q) ||
            u.role?.toLowerCase().includes(q)
          );
        });

        // Sort
        const getStatusOrder = (u: UserWithDetails) => u.is_banned ? 2 : !u.email_confirmed_at ? 1 : 0;
        const sortedUsers = [...filteredUsers].sort((a, b) => {
          let cmp = 0;
          switch (sortField) {
            case "display_name":
              cmp = (a.display_name || "").localeCompare(b.display_name || "");
              break;
            case "email":
              cmp = (a.email || "").localeCompare(b.email || "");
              break;
            case "created_at":
              cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              break;
            case "last_sign_in_at":
              cmp = (a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0) - (b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0);
              break;
            case "status":
              cmp = getStatusOrder(a) - getStatusOrder(b);
              break;
            case "role":
              cmp = getRoleTier(a.role) - getRoleTier(b.role);
              break;
          }
          return sortDir === "asc" ? cmp : -cmp;
        });

        const totalPages = Math.max(1, Math.ceil(sortedUsers.length / USERS_PER_PAGE));
        const safePage = Math.min(currentPage, totalPages);
        const paginatedUsers = sortedUsers.slice((safePage - 1) * USERS_PER_PAGE, safePage * USERS_PER_PAGE);

        const toggleSort = (field: SortField) => {
          if (sortField === field) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
          } else {
            setSortField(field);
            setSortDir(field === "created_at" || field === "last_sign_in_at" ? "desc" : "asc");
          }
          setCurrentPage(1);
        };

        const SortIcon = ({ field }: { field: SortField }) => {
          if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
          return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
        };

        return (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-cream">
                All Users ({filteredUsers.length}{searchQuery ? ` of ${users?.length || 0}` : ""})
              </h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/40" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    placeholder="Search users..."
                    className="pl-9 h-8 w-56 bg-wood-medium/30 border-wood-medium/50 text-cream placeholder:text-cream/40 text-sm"
                  />
                </div>
                <Badge variant="outline" className="text-cream/70">
                  Your role: {getRoleBadge(currentUserRole)}
                </Badge>
              </div>
            </div>

            <div className="rounded-lg border border-wood-medium/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-wood-medium/30 hover:bg-wood-medium/40">
                    <TableHead className="text-cream/70 cursor-pointer select-none" onClick={() => toggleSort("display_name")}>
                      <span className="flex items-center">User<SortIcon field="display_name" /></span>
                    </TableHead>
                    <TableHead className="text-cream/70 cursor-pointer select-none" onClick={() => toggleSort("email")}>
                      <span className="flex items-center">Email<SortIcon field="email" /></span>
                    </TableHead>
                    <TableHead className="text-cream/70 cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                      <span className="flex items-center">Joined<SortIcon field="created_at" /></span>
                    </TableHead>
                    <TableHead className="text-cream/70 cursor-pointer select-none" onClick={() => toggleSort("last_sign_in_at")}>
                      <span className="flex items-center">Last Active<SortIcon field="last_sign_in_at" /></span>
                    </TableHead>
                    <TableHead className="text-cream/70 cursor-pointer select-none" onClick={() => toggleSort("status")}>
                      <span className="flex items-center">Status<SortIcon field="status" /></span>
                    </TableHead>
                    <TableHead className="text-cream/70 cursor-pointer select-none" onClick={() => toggleSort("role")}>
                      <span className="flex items-center">Role<SortIcon field="role" /></span>
                    </TableHead>
                    <TableHead className="text-cream/70">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => {
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
                          ) : !user.email_confirmed_at ? (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                              <Mail className="w-3 h-3 mr-1" />
                              Unconfirmed
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
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/20"
                                  onClick={() => setSuspendDialog({ open: true, user })}
                                >
                                  <Ban className="w-3 h-3 mr-1" />
                                  Suspend
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs border-destructive/50 text-destructive hover:bg-destructive/20"
                                  onClick={() => setDeleteDialog({ open: true, user })}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              </>
                            ) : null}
                            
                            {!user.email_confirmed_at && user.id !== currentUser?.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                                onClick={() => resendConfirmationMutation.mutate(user.id)}
                                disabled={resendConfirmationMutation.isPending}
                              >
                                {resendConfirmationMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                )}
                                Resend Confirm
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paginatedUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-cream/50 py-8">
                        {searchQuery ? "No users match your search" : "No users found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-cream/50">
                  Showing {((safePage - 1) * USERS_PER_PAGE) + 1}–{Math.min(safePage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-wood-medium/50 text-cream"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-cream/40">…</span>
                      ) : (
                        <Button
                          key={p}
                          variant={p === safePage ? "default" : "outline"}
                          size="sm"
                          className={`h-8 w-8 p-0 text-xs ${p === safePage ? "bg-secondary text-secondary-foreground" : "border-wood-medium/50 text-cream"}`}
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </Button>
                      )
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-wood-medium/50 text-cream"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        );
      })()}

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

      {/* Delete User Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => {
        if (!open) {
          setDeleteDialog({ open: false, user: null });
          setDeleteConfirmText("");
        }
      }}>
        <DialogContent className="bg-sidebar border-wood-medium/50">
          <DialogHeader>
            <DialogTitle className="text-cream flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete User Permanently
            </DialogTitle>
            <DialogDescription className="text-cream/70">
              This will permanently delete <span className="font-medium text-cream">{deleteDialog.user?.display_name || deleteDialog.user?.email}</span> and all their data.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium">Warning:</p>
              <ul className="text-xs text-cream/70 mt-1 list-disc list-inside space-y-1">
                <li>User's profile and account will be deleted</li>
                <li>Any libraries they own will be orphaned</li>
                <li>Their roles and memberships will be removed</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Label className="text-cream/80">Type the user's email to confirm:</Label>
              <p className="text-xs font-mono text-cream/60 bg-wood-medium/30 px-2 py-1 rounded">
                {deleteDialog.user?.email}
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type email to confirm..."
                className="bg-wood-medium/30 border-wood-medium/50 text-cream placeholder:text-cream/40 font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialog({ open: false, user: null });
                setDeleteConfirmText("");
              }}
              className="border-wood-medium/50 text-cream"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog.user && deleteUserMutation.mutate(deleteDialog.user.id)}
              disabled={
                deleteUserMutation.isPending ||
                deleteConfirmText.toLowerCase() !== deleteDialog.user?.email?.toLowerCase()
              }
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
