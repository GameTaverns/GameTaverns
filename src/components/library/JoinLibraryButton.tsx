import { useState } from "react";
import { Users, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useLibraryMembership } from "@/hooks/useLibraryMembership";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface JoinLibraryButtonProps {
  libraryId: string;
  libraryName: string;
  showMemberCount?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function JoinLibraryButton({
  libraryId,
  libraryName,
  showMemberCount = true,
  variant = "default",
  size = "default",
}: JoinLibraryButtonProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  
  const {
    isMember,
    memberCount,
    checkingMembership,
    joinLibrary,
    leaveLibrary,
  } = useLibraryMembership(libraryId);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to join this community.",
        variant: "destructive",
      });
      return;
    }

    try {
      await joinLibrary.mutateAsync();
      toast({
        title: "Welcome!",
        description: `You've joined ${libraryName}. You can now borrow games and participate in events.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to join",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLeave = async () => {
    try {
      await leaveLibrary.mutateAsync();
      setShowLeaveDialog(false);
      toast({
        title: "Left community",
        description: `You've left ${libraryName}.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to leave",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (checkingMembership) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (isMember) {
    return (
      <>
        <Button
          variant="outline"
          size={size}
          onClick={() => setShowLeaveDialog(true)}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Member
          {showMemberCount && memberCount !== undefined && (
            <span className="text-muted-foreground">({memberCount})</span>
          )}
        </Button>

        <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave {libraryName}?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll no longer be able to borrow games or participate in community events.
                You can rejoin at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLeave}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {leaveLibrary.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserMinus className="h-4 w-4 mr-2" />
                    Leave
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleJoin}
      disabled={joinLibrary.isPending}
      className="gap-2"
    >
      {joinLibrary.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Join Community
          {showMemberCount && memberCount !== undefined && memberCount > 0 && (
            <span className="text-muted-foreground">({memberCount})</span>
          )}
        </>
      )}
    </Button>
  );
}
