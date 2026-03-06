import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Clock, Package } from "lucide-react";
import { useReturnGame } from "@/hooks/useClubLending";
import { useToast } from "@/hooks/use-toast";
import type { ClubLoan } from "@/hooks/useClubLending";
import { formatDistanceToNow, format } from "date-fns";

interface ClubReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: ClubLoan;
}

const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Poor", "Damaged"];

const CONDITION_RANK: Record<string, number> = {
  "New": 5, "Like New": 4, "Good": 3, "Fair": 2, "Poor": 1, "Damaged": 0,
};

export function ClubReturnDialog({ open, onOpenChange, loan }: ClubReturnDialogProps) {
  const [conditionIn, setConditionIn] = useState(loan.condition_out || "");
  const [notes, setNotes] = useState(loan.notes || "");
  const returnGame = useReturnGame();
  const { toast } = useToast();

  const borrowerLabel = loan.guest_name || loan.borrower_profile?.display_name || "Unknown";
  const gameTitle = loan.game?.title || "Unknown Game";

  const isOverdue = loan.due_at && new Date(loan.due_at) < new Date();
  const loanDuration = formatDistanceToNow(new Date(loan.checked_out_at));

  // Detect if condition degraded
  const conditionDegraded = useMemo(() => {
    if (!loan.condition_out || !conditionIn) return false;
    return (CONDITION_RANK[conditionIn] ?? 3) < (CONDITION_RANK[loan.condition_out] ?? 3);
  }, [conditionIn, loan.condition_out]);

  const handleReturn = async () => {
    try {
      await returnGame.mutateAsync({
        loan_id: loan.id,
        club_id: loan.club_id,
        condition_in: conditionIn || undefined,
        notes: notes.trim() || undefined,
      });
      toast({ title: "✅ Game returned!", description: `${gameTitle} from ${borrowerLabel}` });
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
          {/* Loan summary card */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Checked out {loanDuration} ago
              </span>
              {isOverdue ? (
                <Badge variant="destructive" className="text-xs gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Overdue
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">On time</Badge>
              )}
            </div>
            {loan.copy && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" />
                Copy #{loan.copy.copy_number}
                {loan.copy.copy_label ? ` — ${loan.copy.copy_label}` : ""}
              </p>
            )}
            {loan.guest_contact && (
              <p className="text-xs text-muted-foreground">
                Contact: {loan.guest_contact}
              </p>
            )}
            {loan.due_at && (
              <p className="text-xs text-muted-foreground">
                Due: {format(new Date(loan.due_at), "MMM d, h:mm a")}
              </p>
            )}
          </div>

          {/* Condition at return */}
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

            {/* Condition comparison */}
            {loan.condition_out && conditionIn && (
              <div className={`text-xs px-2 py-1.5 rounded-md ${
                conditionDegraded
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "bg-muted text-muted-foreground"
              }`}>
                {conditionDegraded ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Condition changed: {loan.condition_out} → {conditionIn}
                  </span>
                ) : (
                  <span>Checked out as: {loan.condition_out} — no change</span>
                )}
              </div>
            )}

            {!conditionIn && loan.condition_out && (
              <p className="text-xs text-muted-foreground">
                Checked out as: <strong>{loan.condition_out}</strong>
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={conditionDegraded ? "Describe what happened..." : "Any notes about the return..."}
              rows={conditionDegraded ? 3 : 2}
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
