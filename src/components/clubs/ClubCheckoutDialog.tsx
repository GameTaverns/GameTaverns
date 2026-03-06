import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Package } from "lucide-react";
import { useCheckoutGame, useClubGameCopies } from "@/hooks/useClubLending";
import { useToast } from "@/hooks/use-toast";

interface ClubCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  game: { id: string; title: string; library_id: string; image_url?: string | null; copies_owned?: number };
  staffUserId: string;
  defaultDurationHours: number;
  requireContact: boolean;
}

const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Poor"];

export function ClubCheckoutDialog({
  open, onOpenChange, clubId, game, staffUserId, defaultDurationHours, requireContact,
}: ClubCheckoutDialogProps) {
  const [borrowerType, setBorrowerType] = useState<"guest">("guest");
  const [guestName, setGuestName] = useState("");
  const [guestContact, setGuestContact] = useState("");
  const [conditionOut, setConditionOut] = useState("");
  const [notes, setNotes] = useState("");
  const [durationHours, setDurationHours] = useState(defaultDurationHours.toString());
  const [selectedCopyId, setSelectedCopyId] = useState("");

  const checkout = useCheckoutGame();
  const { data: copies = [] } = useClubGameCopies(game.id);
  const { toast } = useToast();
  const hasMultipleCopies = (game.copies_owned ?? 1) > 1 || copies.length > 1;

  const canSubmit =
    guestName.trim().length > 0 &&
    (!requireContact || guestContact.trim().length > 0);

  const handleSubmit = async () => {
    const dueAt = new Date();
    dueAt.setHours(dueAt.getHours() + parseInt(durationHours, 10));

    try {
      await checkout.mutateAsync({
        club_id: clubId,
        game_id: game.id,
        library_id: game.library_id,
        copy_id: selectedCopyId || undefined,
        guest_name: guestName.trim(),
        guest_contact: guestContact.trim() || undefined,
        condition_out: conditionOut || undefined,
        notes: notes.trim() || undefined,
        due_at: dueAt.toISOString(),
        checked_out_by: staffUserId,
      });
      toast({ title: "Game checked out!", description: `${game.title} → ${guestName}` });
      onOpenChange(false);
      resetForm();
    } catch (e: any) {
      toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setGuestName("");
    setGuestContact("");
    setConditionOut("");
    setNotes("");
    setDurationHours(defaultDurationHours.toString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Check Out Game</DialogTitle>
          <DialogDescription>
            Lending <strong>{game.title}</strong> to a borrower.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Borrower Info */}
          <div className="space-y-2">
            <Label>Borrower Name *</Label>
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter borrower's name"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Contact Info {requireContact ? "*" : "(optional)"}
            </Label>
            <Input
              value={guestContact}
              onChange={(e) => setGuestContact(e.target.value)}
              placeholder="Phone, email, or badge #"
            />
          </div>

          {/* Condition */}
          <div className="space-y-2">
            <Label>Condition at Checkout</Label>
            <Select value={conditionOut} onValueChange={setConditionOut}>
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

          {/* Duration */}
          <div className="space-y-2">
            <Label>Loan Duration (hours)</Label>
            <Input
              type="number"
              min="1"
              max="168"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit || checkout.isPending}
          >
            {checkout.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Check Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
