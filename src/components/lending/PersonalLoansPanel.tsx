import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePersonalLoans, type PersonalLoan } from "@/hooks/usePersonalLoans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameImage } from "@/components/games/GameImage";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/backend/client";
import { useQuery } from "@tanstack/react-query";
import { Plus, Undo2, Trash2, Clock, User, Calendar, Package } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const CONDITIONS = ["Mint", "Like New", "Very Good", "Good", "Acceptable", "Poor"];

interface Props {
  libraryId: string;
}

export function PersonalLoansPanel({ libraryId }: Props) {
  const { activeLoans, returnedLoans, isLoading, createLoan, returnLoan, deleteLoan } = usePersonalLoans(libraryId);
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showReturn, setShowReturn] = useState<PersonalLoan | null>(null);
  const [tab, setTab] = useState("active");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Friend & Family Loans</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Log Loan
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1">
            Active ({activeLoans.length})
          </TabsTrigger>
          <TabsTrigger value="returned" className="flex-1">
            Returned ({returnedLoans.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-2 mt-3">
          {activeLoans.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">
              No active friend/family loans
            </p>
          )}
          {activeLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onReturn={() => setShowReturn(loan)}
              onDelete={() => {
                deleteLoan.mutate(loan.id, {
                  onSuccess: () => toast({ title: "Loan deleted" }),
                  onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                });
              }}
            />
          ))}
        </TabsContent>

        <TabsContent value="returned" className="space-y-2 mt-3">
          {returnedLoans.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">
              No returned loans yet
            </p>
          )}
          {returnedLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onDelete={() => {
                deleteLoan.mutate(loan.id, {
                  onSuccess: () => toast({ title: "Loan record deleted" }),
                  onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                });
              }}
            />
          ))}
        </TabsContent>
      </Tabs>

      <CreateLoanDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        libraryId={libraryId}
        onSubmit={async (data) => {
          await createLoan.mutateAsync(data);
          setShowCreate(false);
          toast({ title: "Loan logged!" });
        }}
      />

      {showReturn && (
        <ReturnDialog
          loan={showReturn}
          open={!!showReturn}
          onOpenChange={(v) => !v && setShowReturn(null)}
          onSubmit={async (data) => {
            await returnLoan.mutateAsync(data);
            setShowReturn(null);
            toast({ title: "Game marked as returned!" });
          }}
        />
      )}
    </div>
  );
}

function LoanCard({ loan, onReturn, onDelete }: { loan: PersonalLoan; onReturn?: () => void; onDelete: () => void }) {
  const isOverdue = loan.due_date && loan.status === "active" && isPast(parseISO(loan.due_date));

  return (
    <Card className={cn("transition-colors", isOverdue && "border-destructive/50")}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-muted">
            {loan.game?.image_url && (
              <GameImage imageUrl={loan.game.image_url} alt={loan.game?.title ?? ""} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-medium text-sm truncate">{loan.game?.title ?? "Unknown Game"}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {loan.borrower_name}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {format(parseISO(loan.loaned_at), "MMM d, yyyy")}
              </span>
              {loan.due_date && (
                <span className={cn("flex items-center gap-1", isOverdue && "text-destructive font-medium")}>
                  <Clock className="h-3 w-3" />
                  Due {format(parseISO(loan.due_date), "MMM d")}
                  {isOverdue && " (overdue)"}
                </span>
              )}
            </div>
            {loan.copy && (
              <Badge variant="outline" className="text-[10px]">
                <Package className="h-2.5 w-2.5 mr-0.5" /> Copy #{loan.copy.copy_number}{loan.copy.copy_label ? ` — ${loan.copy.copy_label}` : ""}
              </Badge>
            )}
            {loan.condition_out && (
              <Badge variant="outline" className="text-[10px]">
                Out: {loan.condition_out}
              </Badge>
            )}
            {loan.condition_in && (
              <Badge variant="outline" className="text-[10px] ml-1">
                In: {loan.condition_in}
              </Badge>
            )}
            {loan.notes && <p className="text-xs text-muted-foreground line-clamp-1">{loan.notes}</p>}
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            {loan.status === "active" && onReturn && (
              <Button variant="outline" size="sm" onClick={onReturn}>
                <Undo2 className="h-3.5 w-3.5 mr-1" /> Return
              </Button>
            )}
            {loan.status === "returned" && (
              <Badge variant="secondary" className="text-xs">Returned</Badge>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateLoanDialog({ open, onOpenChange, libraryId, onSubmit }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  libraryId: string;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [gameSearch, setGameSearch] = useState("");
  const [selectedGame, setSelectedGame] = useState<{ id: string; title: string; image_url: string | null; copies_owned?: number } | null>(null);
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerContact, setBorrowerContact] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [conditionOut, setConditionOut] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCopyId, setSelectedCopyId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["personal-loan-game-search", libraryId, gameSearch],
    queryFn: async () => {
      if (gameSearch.length < 2) return [];
      const { data } = await (supabase as any)
        .from("games")
        .select("id, title, image_url, copies_owned")
        .eq("library_id", libraryId)
        .ilike("title", `%${gameSearch}%`)
        .limit(8);
      return data || [];
    },
    enabled: gameSearch.length >= 2,
  });

  // Fetch copies for selected game
  const { data: gameCopies = [] } = useQuery({
    queryKey: ["personal-loan-copies", selectedGame?.id],
    queryFn: async () => {
      if (!selectedGame) return [];
      const { data } = await (supabase as any)
        .from("game_copies")
        .select("id, copy_number, copy_label, condition, edition, language")
        .eq("game_id", selectedGame.id)
        .order("copy_number");
      return data || [];
    },
    enabled: !!selectedGame?.id,
  });

  // Fetch availability for selected game
  const { data: availability } = useQuery({
    queryKey: ["personal-loan-availability", selectedGame?.id],
    queryFn: async () => {
      if (!selectedGame) return null;
      const copiesOwned = selectedGame.copies_owned ?? 1;

      const { count: personalCount } = await (supabase as any)
        .from("personal_loans")
        .select("id", { count: "exact", head: true })
        .eq("game_id", selectedGame.id)
        .in("status", ["active", "overdue"]);

      const { count: clubCount } = await (supabase as any)
        .from("club_loans")
        .select("id", { count: "exact", head: true })
        .eq("game_id", selectedGame.id)
        .eq("status", "checked_out");

      const { count: libraryLoanCount } = await (supabase as any)
        .from("game_loans")
        .select("id", { count: "exact", head: true })
        .eq("game_id", selectedGame.id)
        .in("status", ["approved", "active"]);

      const totalOut = (personalCount ?? 0) + (clubCount ?? 0) + (libraryLoanCount ?? 0);
      return { copiesOwned, totalOut, available: Math.max(0, copiesOwned - totalOut) };
    },
    enabled: !!selectedGame?.id,
  });

  const handleSubmit = async () => {
    if (!selectedGame || !borrowerName.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        library_id: libraryId,
        game_id: selectedGame.id,
        borrower_name: borrowerName.trim(),
        borrower_contact: borrowerContact.trim() || undefined,
        due_date: dueDate || undefined,
        condition_out: conditionOut || undefined,
        notes: notes.trim() || undefined,
        copy_id: selectedCopyId && selectedCopyId !== "none" ? selectedCopyId : undefined,
      });
      // Reset
      setSelectedGame(null);
      setGameSearch("");
      setBorrowerName("");
      setBorrowerContact("");
      setDueDate("");
      setConditionOut("");
      setNotes("");
      setSelectedCopyId("");
    } finally {
      setSubmitting(false);
    }
  };

  const noAvailability = availability && availability.available <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a Friend/Family Loan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Game search */}
          <div>
            <Label>Game *</Label>
            {selectedGame ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 p-2 border rounded-lg mt-1">
                  <div className="w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
                    {selectedGame.image_url && <GameImage imageUrl={selectedGame.image_url} alt={selectedGame.title} className="w-full h-full object-cover" />}
                  </div>
                  <span className="text-sm font-medium flex-1 truncate">{selectedGame.title}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedGame(null); setGameSearch(""); setSelectedCopyId(""); }}>Change</Button>
                </div>
                {/* Availability indicator */}
                {availability && (
                  <div className={cn(
                    "text-xs px-2 py-1 rounded-md flex items-center gap-1.5",
                    noAvailability ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                  )}>
                    <Package className="h-3 w-3" />
                    {availability.available} of {availability.copiesOwned} available
                    {availability.totalOut > 0 && ` (${availability.totalOut} out on loan)`}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative mt-1">
                <Input
                  value={gameSearch}
                  onChange={(e) => setGameSearch(e.target.value)}
                  placeholder="Search your library..."
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-popover border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.map((g: any) => (
                      <button
                        key={g.id}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left text-sm"
                        onClick={() => { setSelectedGame(g); setGameSearch(""); }}
                      >
                        <div className="w-7 h-7 rounded overflow-hidden bg-muted flex-shrink-0">
                          {g.image_url && <GameImage imageUrl={g.image_url} alt={g.title} className="w-full h-full object-cover" />}
                        </div>
                        {g.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Copy picker (optional, shown when copies exist) */}
          {gameCopies.length > 0 && selectedGame && (
            <div>
              <Label>Select Copy (optional)</Label>
              <Select value={selectedCopyId} onValueChange={setSelectedCopyId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Any copy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any copy</SelectItem>
                  {gameCopies.map((copy: any) => (
                    <SelectItem key={copy.id} value={copy.id}>
                      Copy #{copy.copy_number}
                      {copy.copy_label ? ` — ${copy.copy_label}` : ""}
                      {copy.edition ? ` (${copy.edition})` : ""}
                      {copy.condition ? ` [${copy.condition}]` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Borrower */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Borrower Name *</Label>
              <Input value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="e.g. John" className="mt-1" />
            </div>
            <div>
              <Label>Contact (optional)</Label>
              <Input value={borrowerContact} onChange={(e) => setBorrowerContact(e.target.value)} placeholder="Phone or email" className="mt-1" />
            </div>
          </div>

          {/* Due date & condition */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Due Date (optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Condition Out</Label>
              <Select value={conditionOut} onValueChange={setConditionOut}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any details..." className="mt-1" rows={2} />
          </div>

          {noAvailability && (
            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-md">
              ⚠ All copies are currently out on loan. You can still log this loan but availability will show as negative.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!selectedGame || !borrowerName.trim() || submitting}>
            {submitting ? "Saving..." : "Log Loan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({ loan, open, onOpenChange, onSubmit }: {
  loan: PersonalLoan;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: { loanId: string; condition_in?: string; notes?: string }) => Promise<void>;
}) {
  const [conditionIn, setConditionIn] = useState(loan.condition_out || "");
  const [notes, setNotes] = useState(loan.notes || "");
  const [submitting, setSubmitting] = useState(false);

  const conditionDegraded = loan.condition_out && conditionIn &&
    CONDITIONS.indexOf(conditionIn) > CONDITIONS.indexOf(loan.condition_out);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        loanId: loan.id,
        condition_in: conditionIn || undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Return: {loan.game?.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Borrowed by <strong>{loan.borrower_name}</strong> on {format(parseISO(loan.loaned_at), "MMM d, yyyy")}
          </div>
          <div>
            <Label>Condition Returned</Label>
            <Select value={conditionIn} onValueChange={setConditionIn}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {conditionDegraded && (
              <p className="text-xs text-destructive mt-1">⚠ Condition has degraded from "{loan.condition_out}"</p>
            )}
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Mark Returned"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
