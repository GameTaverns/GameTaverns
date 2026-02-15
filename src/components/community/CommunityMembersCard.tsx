import { useState } from "react";
import { Users, Shield, ShieldCheck, UserMinus, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLibraryMembers } from "@/hooks/useLibraryMembership";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function CommunityMembersCard() {
  const { user } = useAuth();
  const { data: library } = useMyLibrary();
  const { data: members = [], isLoading } = useLibraryMembers(library?.id);
  const queryClient = useQueryClient();
  const [acting, setActing] = useState<string | null>(null);

  const isOwner = library?.owner_id === user?.id;

  const handleSetRole = async (memberId: string, userId: string, newRole: "member" | "moderator") => {
    if (!library?.id) return;
    setActing(memberId);
    try {
      const { error } = await supabase
        .from("library_members")
        .update({ role: newRole })
        .eq("id", memberId)
        .eq("library_id", library.id);
      if (error) throw error;
      toast.success(`Role updated to ${newRole}`);
      queryClient.invalidateQueries({ queryKey: ["library-members", library.id] });
    } catch (e: any) {
      toast.error(e.message || "Failed to update role");
    } finally {
      setActing(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!library?.id) return;
    setActing(memberId);
    try {
      const { error } = await supabase
        .from("library_members")
        .delete()
        .eq("id", memberId)
        .eq("library_id", library.id);
      if (error) throw error;
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["library-members", library.id] });
      queryClient.invalidateQueries({ queryKey: ["library-member-count", library.id] });
    } catch (e: any) {
      toast.error(e.message || "Failed to remove member");
    } finally {
      setActing(null);
    }
  };

  const roleIcon = (role: string) => {
    if (role === "owner") return <Crown className="h-3.5 w-3.5 text-secondary" />;
    if (role === "moderator") return <ShieldCheck className="h-3.5 w-3.5 text-secondary" />;
    return null;
  };

  return (
    <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-secondary" />
          Community Members
          {members.length > 0 && (
            <Badge variant="secondary" className="text-xs">{members.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-cream/50 text-sm text-center py-4">Loading...</p>
        ) : members.length === 0 ? (
          <p className="text-cream/50 text-sm text-center py-4">No members yet.</p>
        ) : (
          <ScrollArea className="max-h-[320px]">
            <div className="space-y-1.5 pr-2">
              {members.map((member) => {
                const displayName = member.user_profiles?.display_name || member.user_profiles?.username || "Unknown";
                const isSelf = member.user_id === user?.id;
                const isOwnerRow = member.role === "owner";

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between py-2 px-3 rounded-md bg-wood-medium/20 hover:bg-wood-medium/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {roleIcon(member.role)}
                      <span className="text-sm truncate">{displayName}</span>
                      {isSelf && <Badge variant="outline" className="text-[10px] h-4 border-cream/30">You</Badge>}
                    </div>

                    {isOwner && !isOwnerRow && !isSelf && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {member.role === "member" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-cream/70 hover:text-cream"
                            disabled={acting === member.id}
                            onClick={() => handleSetRole(member.id, member.user_id, "moderator")}
                            title="Promote to Moderator"
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-cream/70 hover:text-cream"
                            disabled={acting === member.id}
                            onClick={() => handleSetRole(member.id, member.user_id, "member")}
                            title="Demote to Member"
                          >
                            <Shield className="h-3.5 w-3.5 opacity-50" />
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive/70 hover:text-destructive"
                              disabled={acting === member.id}
                              title="Remove from community"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove <strong>{displayName}</strong> from your community? They can rejoin later.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemove(member.id)}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
