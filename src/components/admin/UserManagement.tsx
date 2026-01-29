import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Shield, User, UserCog, Ban, UserCheck, Mail, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

interface UserWithDetails {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: "admin" | "moderator" | "user" | null;
  is_banned: boolean;
  banned_until: string | null;
}

export function UserManagement() {
  const queryClient = useQueryClient();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; user: UserWithDetails | null }>({ open: false, user: null });
  const [suspendDuration, setSuspendDuration] = useState<string>("7d");
  const [suspendReason, setSuspendReason] = useState("");

  // Fetch users via edge function (includes email from auth.users)
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users-full"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });

      if (error) throw error;
      return data.users as UserWithDetails[];
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: "admin" | "moderator" | "user" | "none" }) => {
      setUpdatingUserId(userId);
      
      if (newRole === "none") {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
        if (error) throw error;
      } else {
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingRole) {
          const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-full"] });
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
      {/* Role Legend */}
      <div className="bg-wood-medium/20 rounded-lg p-4 border border-wood-medium/30">
        <h4 className="font-semibold text-cream mb-2">Role Permissions</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-red-400 mt-0.5" />
            <div>
              <span className="text-cream font-medium">Admin</span>
              <p className="text-cream/60">Full platform access: manage users, libraries, settings, view all data</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <UserCog className="w-4 h-4 text-blue-400 mt-0.5" />
            <div>
              <span className="text-cream font-medium">Moderator</span>
              <p className="text-cream/60">Content moderation (reserved for future use)</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-green-400 mt-0.5" />
            <div>
              <span className="text-cream font-medium">User / No Role</span>
              <p className="text-cream/60">Standard access: can create & manage their own libraries only</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-cream">All Users ({users?.length || 0})</h3>
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
            {users?.map((user) => (
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
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Select
                      value={user.role || "none"}
                      onValueChange={(value) => 
                        updateRoleMutation.mutate({ 
                          userId: user.id, 
                          newRole: value as "admin" | "moderator" | "user" | "none" 
                        })
                      }
                      disabled={updatingUserId === user.id}
                    >
                      <SelectTrigger className="w-28 h-8 bg-wood-medium/30 border-wood-medium/50 text-cream text-xs">
                        {updatingUserId === user.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
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
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/20"
                        onClick={() => setSuspendDialog({ open: true, user })}
                      >
                        <Ban className="w-3 h-3 mr-1" />
                        Suspend
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
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
                <Ban className="h-4 w-4 mr-2" />
              )}
              Suspend User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}