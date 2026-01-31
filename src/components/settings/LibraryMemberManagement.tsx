import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UserMinus, Users, Shield, Crown, ShieldCheck, ShieldOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const handleRemoveMember = async () => {
    if (!removingMemberId) return;
    
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from("library_members")
        .delete()
        .eq("id", removingMemberId);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: "The member has been removed from your community.",
      });

      queryClient.invalidateQueries({ queryKey: ["library-members", library?.id] });
      queryClient.invalidateQueries({ queryKey: ["library-member-count", library?.id] });
    } catch (error: any) {
      toast({
        title: "Error removing member",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
      setRemovingMemberId(null);
    }
  };

  const handleToggleModerator = async (memberId: string, currentRole: string) => {
    if (!isOwner) return;
    
    setUpdatingRoleId(memberId);
    const newRole = currentRole === "moderator" ? "member" : "moderator";
    
    try {
      const { error } = await supabase
        .from("library_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: newRole === "moderator" ? "Moderator assigned" : "Moderator removed",
        description: newRole === "moderator" 
          ? "This member can now manage polls, events, and remove users."
          : "This member no longer has moderator privileges.",
      });

      queryClient.invalidateQueries({ queryKey: ["library-members", library?.id] });
    } catch (error: any) {
      toast({
        title: "Error updating role",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingRoleId(null);
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
          <CardDescription>
            We couldn't load your member list. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              "Retry"
            )}
          </Button>
          <div className="text-sm text-muted-foreground truncate">
            {(error as any)?.message || "Unknown error"}
          </div>
        </CardContent>
      </Card>
    );
  }

  const membersList = members ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community Members
          </CardTitle>
          <CardDescription>
            Manage the members of your community. Members can borrow games, vote in polls, and RSVP to events.
            {isOwner && " As the owner, you can assign moderators who can manage polls, events, and remove members."}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Crown className="h-3.5 w-3.5 text-primary" />
                <span><strong>Owner</strong> - Full control</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-secondary" />
                <span><strong>Moderator</strong> - Manage polls, events, users</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span><strong>Member</strong> - Participate in community</span>
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
                    
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {displayName}
                        </TableCell>
                        <TableCell>
                          {getRoleBadge(memberRole)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(member.joined_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Moderator toggle - only for owners, not on owner row */}
                            {isOwner && memberRole !== "owner" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={memberRole === "moderator" 
                                      ? "text-secondary hover:text-secondary hover:bg-secondary/10" 
                                      : "text-muted-foreground hover:text-secondary hover:bg-secondary/10"
                                    }
                                    onClick={() => handleToggleModerator(member.id, memberRole)}
                                    disabled={isUpdatingRole}
                                  >
                                    {isUpdatingRole ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : memberRole === "moderator" ? (
                                      <ShieldOff className="h-4 w-4" />
                                    ) : (
                                      <ShieldCheck className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {memberRole === "moderator" 
                                    ? "Remove moderator role" 
                                    : "Make moderator"
                                  }
                                </TooltipContent>
                              </Tooltip>
                            )}
                            
                            {/* Remove member - not for owner */}
                            {memberRole !== "owner" && (
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
              {isRemoving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Member"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}