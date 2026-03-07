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
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Package, UserCheck, ChevronDown, Settings2 } from "lucide-react";
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
  const [showOptional, setShowOptional] = useState(
    !!(draft?.conditionOut || draft?.notes || draft?.selectedCopyId)
  );
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
    if (!canSubmit || checkout.isPending) return;

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
    setShowOptional(false);
    clearCheckoutDraft();
  };

  const selectSuggestion = (borrower: { name: string; contact: string }) => {
    setGuestName(borrower.name);
    setGuestContact(borrower.contact);
    setShowSuggestions(false);
  };

  // Keyboard: Enter to submit from required fields
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && canSubmit && !checkout.isPending) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            Check Out Game
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {game.image_url && (
              <img src={game.image_url} alt={game.title} className="h-8 w-8 rounded object-cover shrink-0" />
            )}
            <span>Lending <strong>{game.title}</strong></span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1" onKeyDown={handleKeyDown}>
          {/* ── Required: Borrower Name with autocomplete ── */}
          <div className="space-y-1.5 relative">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Borrower Name *
            </Label>
            <Input
              ref={nameInputRef}
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Enter borrower's name"
              autoComplete="off"
              className="h-11 text-base"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredSuggestions.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors"
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

          {/* ── Required if configured: Contact ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contact Info {requireContact ? "*" : "(optional)"}
            </Label>
            <Input
              value={guestContact}
              onChange={(e) => setGuestContact(e.target.value)}
              placeholder="Phone, email, or badge #"
              className="h-10"
            />
          </div>

          {/* ── Duration (always visible, compact) ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Loan Duration (hours)
            </Label>
            <Input
              type="number"
              min="1"
              max="168"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              className="h-10"
            />
          </div>

          {/* ── Collapsible optional fields ── */}
          <Collapsible open={showOptional} onOpenChange={setShowOptional}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-1"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span>{showOptional ? "Hide" : "Show"} optional fields</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ml-auto ${showOptional ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Copy selector */}
              {hasMultipleCopies && copies.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Condition at Checkout
                </Label>
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

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Submit ── */}
          <Button
            className="w-full h-11 text-base"
            onClick={handleSubmit}
            disabled={!canSubmit || checkout.isPending}
          >
            {checkout.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Check Out
            {canSubmit && !checkout.isPending && (
              <span className="text-xs ml-2 opacity-60">↵</span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
