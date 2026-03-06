import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, UserCheck } from "lucide-react";
import { useCheckoutGame, useClubGameCopies, getRecentBorrowers, saveRecentBorrower } from "@/hooks/useClubLending";
import { useToast } from "@/hooks/use-toast";

interface ClubCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  game: { id: string; title: string; library_id: string; image_url?: string | null; copies_owned?: number };
  staffUserId: string;
  defaultDurationHours: number;
  requireContact: boolean;
  /** Called after successful checkout so parent can re-focus search */
  onCheckoutComplete?: () => void;
}

const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Poor"];
const CHECKOUT_DRAFT_KEY = "club-checkout-draft";

interface CheckoutDraft {
  guestName: string;
  guestContact: string;
  conditionOut: string;
  notes: string;
  durationHours: string;
  selectedCopyId: string;
  gameId: string;
}

function loadCheckoutDraft(gameId: string): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    const draft: CheckoutDraft = JSON.parse(raw);
    // Only restore if it's for the same game
    return draft.gameId === gameId ? draft : null;
  } catch { return null; }
}

function saveCheckoutDraft(draft: CheckoutDraft) {
  try { sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft)); } catch {}
}

function clearCheckoutDraft() {
  sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
}

export function ClubCheckoutDialog({
  open, onOpenChange, clubId, game, staffUserId, defaultDurationHours, requireContact,
  onCheckoutComplete,
}: ClubCheckoutDialogProps) {
  const draft = useMemo(() => loadCheckoutDraft(game.id), [game.id]);

  const [guestName, setGuestName] = useState(draft?.guestName ?? "");
  const [guestContact, setGuestContact] = useState(draft?.guestContact ?? "");
  const [conditionOut, setConditionOut] = useState(draft?.conditionOut ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [durationHours, setDurationHours] = useState(draft?.durationHours ?? defaultDurationHours.toString());
  const [selectedCopyId, setSelectedCopyId] = useState(draft?.selectedCopyId ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const checkout = useCheckoutGame();
  const { data: copies = [] } = useClubGameCopies(game.id);
  const { toast } = useToast();
  const hasMultipleCopies = (game.copies_owned ?? 1) > 1 || copies.length > 1;

  // Auto-save draft on changes (debounced)
  const saveDraftDebounced = useCallback(() => {
    saveCheckoutDraft({
      guestName, guestContact, conditionOut, notes, durationHours, selectedCopyId, gameId: game.id,
    });
  }, [guestName, guestContact, conditionOut, notes, durationHours, selectedCopyId, game.id]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(saveDraftDebounced, 300);
    return () => clearTimeout(timer);
  }, [saveDraftDebounced, open]);

  // Recent borrowers for quick-fill
  const recentBorrowers = useMemo(() => getRecentBorrowers(clubId), [clubId, open]);
  const filteredSuggestions = useMemo(() => {
    if (!guestName.trim()) return recentBorrowers.slice(0, 5);
    const q = guestName.toLowerCase();
    return recentBorrowers
      .filter((b) => b.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [guestName, recentBorrowers]);

  // Auto-focus name input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [open]);

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

      // Save to recent borrowers
      saveRecentBorrower(clubId, guestName.trim(), guestContact.trim());

      toast({ title: "✅ Checked out!", description: `${game.title} → ${guestName.trim()}` });
      onOpenChange(false);
      resetForm();
      onCheckoutComplete?.();
    } catch (e: any) {
      toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setGuestName("");
    setGuestContact("");
    setConditionOut("");
    setNotes("");
    setSelectedCopyId("");
    setDurationHours(defaultDurationHours.toString());
    setShowSuggestions(false);
    clearCheckoutDraft();
  };

  const selectSuggestion = (borrower: { name: string; contact: string }) => {
    setGuestName(borrower.name);
    setGuestContact(borrower.contact);
    setShowSuggestions(false);
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
          {/* Borrower Name with autocomplete */}
          <div className="space-y-2 relative">
            <Label>Borrower Name *</Label>
            <Input
              ref={nameInputRef}
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Enter borrower's name"
              autoComplete="off"
            />
            {/* Quick-fill suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredSuggestions.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(b);
                    }}
                  >
                    <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground">{b.name}</span>
                    {b.contact && (
                      <span className="text-muted-foreground text-xs ml-auto truncate max-w-[120px]">
                        {b.contact}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
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

          {/* Copy selector (only shown when multiple copies exist) */}
          {hasMultipleCopies && copies.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Which Copy?
              </Label>
              <Select value={selectedCopyId} onValueChange={setSelectedCopyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a copy (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {copies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Copy #{c.copy_number}
                      {c.copy_label ? ` — ${c.copy_label}` : ""}
                      {c.condition ? ` (${c.condition})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
