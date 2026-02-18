import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UserMinus, Users, Shield, Crown, ShieldCheck, ShieldOff, UserPlus, KeyRound, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTenant } from "@/contexts/TenantContext";
import { useLibraryMembers, useLibraryMembership } from "@/hooks/useLibraryMembership";
import { supabase } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function LibraryMemberManagement() {
  const { library, isOwner } = useTenant();
  const {
    data: members,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useLibraryMembers(library?.id);
  const { memberCount } = useLibraryMembership(library?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // Co-owner invite state
  const [inviteQuery, setInviteQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [foundUser, setFoundUser] = useState<{ user_id: string; display_name: string | null; username: string | null } | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  const handleRemoveMember = async () => {
    if (!removingMemberId) return;
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from("library_members")
        .delete()
        .eq("id", removingMemberId);
      if (error) throw error;
      toast({ title: "Member removed", description: "The member has been removed from your community." });
      queryClient.invalidateQueries({ queryKey: ["library-members", library?.id] });
      queryClient.invalidateQueries({ queryKey: ["library-member-count", library?.id] });
    } catch (error: any) {
      toast({ title: "Error removing member", description: error.message, variant: "destructive" });
    } finally {
      setIsRemoving(false);
      setRemovingMemberId(null);
    }
  };

  const handleSetRole = async (memberId: string, newRole: "member" | "moderator" | "co_owner") => {
    if (!isOwner) return;
    setUpdatingRoleId(memberId);
    try {
      const { error } = await supabase
        .from("library_members")
        .update({ role: newRole })
        .eq("id", memberId);
      if (error) throw error;
      const labels: Record<string, string> = {
        co_owner: "Co-owner assigned — they now have full library access.",
        moderator: "Moderator assigned — they can manage polls, events, and members.",
        member: "Role updated to regular member.",
      };
      toast({ title: "Role updated", description: labels[newRole] });
      queryClient.invalidateQueries({ queryKey: ["library-members", library?.id] });
    } catch (error: any) {
      toast({ title: "Error updating role", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleSearchUser = async () => {
    if (!inviteQuery.trim()) return;
    setIsSearching(true);
    setFoundUser(null);
    setSearchAttempted(true);
    try {
      const q = inviteQuery.trim().replace(/^@/, "");
      const { data, error } = await (supabase as any)
        .from("user_profiles")
        .select("user_id, display_name, username")
        .or(`username.ilike.${q},display_name.ilike.${q}`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setFoundUser(data ?? null);
    } catch (error: any) {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleInviteAsCoOwner = async () => {
    if (!foundUser || !library?.id) return;
    setIsInviting(true);
    try {
      // Check if already a member
      const { data: existing } = await supabase
        .from("library_members")
        .select("id, role")
        .eq("library_id", library.id)
        .eq("user_id", foundUser.user_id)
        .maybeSingle();

      if (existing) {
        // Update their role
        const { error } = await supabase
          .from("library_members")
          .update({ role: "co_owner" })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert as co_owner
        const { error } = await supabase
          .from("library_members")
          .insert({ library_id: library.id, user_id: foundUser.user_id, role: "co_owner" });
        if (error) throw error;
      }

      toast({
        title: "Co-owner added!",
        description: `${foundUser.display_name || foundUser.username} now has full co-owner access to your library.`,
      });
      setInviteQuery("");
      setFoundUser(null);
      setSearchAttempted(false);
      queryClient.invalidateQueries({ queryKey: ["library-members", library?.id] });
      queryClient.invalidateQueries({ queryKey: ["library-member-count", library?.id] });
    } catch (error: any) {
      toast({ title: "Failed to add co-owner", description: error.message, variant: "destructive" });
    } finally {
      setIsInviting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return (
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <Crown className="h-3 w-3 mr-1" />
            Owner
          </Badge>
        );
      case "co_owner":
        return (
          <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
            <KeyRound className="h-3 w-3 mr-1" />
            Co-owner
          </Badge>
        );
      case "moderator":
        return (
          <Badge className="bg-secondary/20 text-secondary border-secondary/30">
            <Shield className="h-3 w-3 mr-1" />
            Moderator
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-muted/50">
            Member
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community Members
          </CardTitle>
          <CardDescription>We couldn't load your member list. Please try again.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Retrying...</> : "Retry"}
          </Button>
          <div className="text-sm text-muted-foreground truncate">{(error as any)?.message || "Unknown error"}</div>
        </CardContent>
      </Card>
    );
  }

  const membersList = members ?? [];

  return (
    <div className="space-y-6">
      {/* Co-owner invite panel — owners only */}
      {isOwner && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-amber-500" />
              Invite a Co-owner
            </CardTitle>
            <CardDescription>
              Co-owners have the same full access as you — managing games, settings, loans, and members. They cannot delete the library.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search by username or display name…"
                  value={inviteQuery}
                  onChange={(e) => { setInviteQuery(e.target.value); setSearchAttempted(false); setFoundUser(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchUser()}
                />
              </div>
              <Button variant="outline" onClick={handleSearchUser} disabled={isSearching || !inviteQuery.trim()}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            {searchAttempted && !isSearching && (
              foundUser ? (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
                  <div>
                    <div className="font-medium">{foundUser.display_name || foundUser.username}</div>
                    {foundUser.username && <div className="text-xs text-muted-foreground">@{foundUser.username}</div>}
                  </div>
                  <Button size="sm" onClick={handleInviteAsCoOwner} disabled={isInviting}>
                    {isInviting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                    Add as Co-owner
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No user found with that name. Make sure they have created an account first.</p>
              )
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community Members
          </CardTitle>
          <CardDescription>
            Manage the members of your community.
            {isOwner && " As the owner, you can assign co-owners, moderators, or remove members."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-primary">{memberCount ?? 0}</div>
            <div className="text-sm text-muted-foreground">Total Members</div>
          </div>

          {/* Role Legend */}
          <div className="mb-4 p-3 bg-muted/20 rounded-lg border border-border/50">
            <h4 className="text-sm font-medium mb-2">Community Roles</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Crown className="h-3.5 w-3.5 text-primary" />
                <span><strong>Owner</strong> — Full control + delete</span>
              </div>
              <div className="flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                <span><strong>Co-owner</strong> — Full control</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-secondary" />
                <span><strong>Moderator</strong> — Polls, events, members</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span><strong>Member</strong> — Participate</span>
              </div>
            </div>
          </div>

          {membersList.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersList.map((member) => {
                    const profile = member.user_profiles as { display_name?: string; username?: string } | null;
                    const displayName = profile?.display_name || profile?.username || "Unknown User";
                    const memberRole = member.role as string;
                    const isUpdatingRole = updatingRoleId === member.id;
                    const isProtectedRow = memberRole === "owner";

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{displayName}</TableCell>
                        <TableCell>{getRoleBadge(memberRole)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(member.joined_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isOwner && !isProtectedRow && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-secondary hover:bg-secondary/10"
                                        disabled={isUpdatingRole}
                                      >
                                        {isUpdatingRole ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <ShieldCheck className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Change role</TooltipContent>
                                  </Tooltip>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleSetRole(member.id, "co_owner")}
                                    disabled={memberRole === "co_owner"}
                                    className="gap-2"
                                  >
                                    <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                                    Make Co-owner
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleSetRole(member.id, "moderator")}
                                    disabled={memberRole === "moderator"}
                                    className="gap-2"
                                  >
                                    <Shield className="h-3.5 w-3.5 text-secondary" />
                                    Make Moderator
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleSetRole(member.id, "member")}
                                    disabled={memberRole === "member"}
                                    className="gap-2"
                                  >
                                    <Users className="h-3.5 w-3.5" />
                                    Set as Member
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}

                            {!isProtectedRow && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setRemovingMemberId(member.id)}
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Remove from community</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : memberCount && memberCount > 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
              <p>Loading members…</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["library-members", library?.id] });
                  refetch();
                }}
                disabled={isFetching}
              >
                Refresh
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No members have joined your community yet.</p>
              <p className="text-sm mt-1">Share your library link to invite people to join!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!removingMemberId} onOpenChange={(open) => !open && setRemovingMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from your community? They will lose access to member-only features like borrowing games and voting in polls.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Removing...</> : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
