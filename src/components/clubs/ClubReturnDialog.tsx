import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useReturnGame } from "@/hooks/useClubLending";
import { useToast } from "@/hooks/use-toast";
import type { ClubLoan } from "@/hooks/useClubLending";

interface ClubReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: ClubLoan;
}

const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Poor", "Damaged"];

export function ClubReturnDialog({ open, onOpenChange, loan }: ClubReturnDialogProps) {
  const [conditionIn, setConditionIn] = useState("");
  const [notes, setNotes] = useState(loan.notes || "");
  const returnGame = useReturnGame();
  const { toast } = useToast();

  const borrowerLabel = loan.guest_name || loan.borrower_profile?.display_name || "Unknown";
  const gameTitle = loan.game?.title || "Unknown Game";

  const handleReturn = async () => {
    try {
      await returnGame.mutateAsync({
        loan_id: loan.id,
        club_id: loan.club_id,
        condition_in: conditionIn || undefined,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Game returned!", description: `${gameTitle} from ${borrowerLabel}` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Return failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Return Game</DialogTitle>
          <DialogDescription>
            Returning <strong>{gameTitle}</strong> from {borrowerLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Condition at Return</Label>
            <Select value={conditionIn} onValueChange={setConditionIn}>
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loan.condition_out && (
            <p className="text-sm text-muted-foreground">
              Checked out as: <strong>{loan.condition_out}</strong>
            </p>
          )}

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about the return..."
              rows={2}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleReturn}
            disabled={returnGame.isPending}
          >
            {returnGame.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Confirm Return
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
