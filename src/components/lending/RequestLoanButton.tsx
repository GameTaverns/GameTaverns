import { useState, useEffect } from "react";
import { useLending } from "@/hooks/useLending";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/backend/client";
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
  const { requestLoan, checkGameAvailability } = useLending();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
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

  // Don't show if lending is disabled or user is the owner
  if (!allowLending || (user && user.id === lenderUserId)) {
    return null;
  }

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    
    if (newOpen && isAvailable === null) {
      setIsChecking(true);
      const available = await checkGameAvailability(gameId);
      setIsAvailable(available);
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
          <div className="py-4 text-center">
            <p className="text-muted-foreground">
              This game is currently on loan or has a pending request.
            </p>
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
