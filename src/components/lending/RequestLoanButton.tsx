import { useState, useEffect } from "react";
import { useLending } from "@/hooks/useLending";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/backend/client";
import { useQuery } from "@tanstack/react-query";
import { useLibraryMembership } from "@/hooks/useLibraryMembership";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RequestLoanButtonProps {
  gameId: string;
  gameTitle: string;
  gameImageUrl?: string | null;
  libraryId: string;
  lenderUserId: string;
  allowLending?: boolean;
}

export function RequestLoanButton({
  gameId,
  gameTitle,
  gameImageUrl,
  libraryId,
  lenderUserId,
  allowLending = true,
}: RequestLoanButtonProps) {
  const { user } = useAuth();
  const { requestLoan, checkGameAvailability, joinWaitlist } = useLending();
  const { isMember, checkingMembership } = useLibraryMembership(libraryId);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [availabilityInfo, setAvailabilityInfo] = useState<{ copiesOwned: number; copiesAvailable: number } | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  // Fetch user's display name when component mounts or user changes
  useEffect(() => {
    if (!user) return;
    
    supabase
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name || null);
      });
  }, [user]);

  // Don't show if lending is disabled, user is the owner, or user is not a member
  if (!allowLending || (user && user.id === lenderUserId) || checkingMembership) {
    return null;
  }

  if (!isMember) {
    return null;
  }

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    
    if (newOpen && isAvailable === null) {
      setIsChecking(true);
      const result = await checkGameAvailability(gameId);
      setIsAvailable(result.available);
      setAvailabilityInfo({ copiesOwned: result.copiesOwned, copiesAvailable: result.copiesAvailable });
      setIsChecking(false);
    }
  };

  const handleRequest = async () => {
    if (!user) {
      toast.error("Please log in to request a loan");
      return;
    }

    try {
      await requestLoan.mutateAsync({
        gameId,
        libraryId,
        lenderUserId,
        notes: notes.trim() || undefined,
        gameTitle,
        gameImageUrl: gameImageUrl || undefined,
        borrowerName: displayName || user.email?.split("@")[0] || "Someone",
      });
      setOpen(false);
      setNotes("");
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BookOpen className="h-4 w-4" />
          Request to Borrow
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request to Borrow</DialogTitle>
          <DialogDescription>
            Request to borrow "{gameTitle}" from this library
          </DialogDescription>
        </DialogHeader>

        {isChecking ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Checking availability...</span>
          </div>
        ) : !isAvailable ? (
          <div className="py-4 text-center space-y-4">
            <p className="text-muted-foreground">
              All {availabilityInfo?.copiesOwned ?? 1} {(availabilityInfo?.copiesOwned ?? 1) === 1 ? 'copy' : 'copies'} of this game {(availabilityInfo?.copiesOwned ?? 1) === 1 ? 'is' : 'are'} currently on loan or have pending requests.
            </p>
            {user && (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await joinWaitlist.mutateAsync({ gameId, libraryId });
                    setOpen(false);
                  } catch {}
                }}
                disabled={joinWaitlist.isPending}
              >
                Join Waitlist
              </Button>
            )}
          </div>
        ) : !user ? (
          <div className="py-4 text-center">
            <p className="text-muted-foreground mb-4">
              Please log in to request a loan
            </p>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            {availabilityInfo && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {availabilityInfo.copiesAvailable} of {availabilityInfo.copiesOwned} {availabilityInfo.copiesOwned === 1 ? 'copy' : 'copies'} available
              </div>
            )}
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Message to Owner (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="When would you like to pick it up? Any other details..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRequest}
                disabled={requestLoan.isPending}
              >
                {requestLoan.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Request"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
