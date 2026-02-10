import { useState } from "react";
import { useLending, type GameLoan, type LoanStatus } from "@/hooks/useLending";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, formatDistanceToNow, isPast, addDays } from "date-fns";
import { 
  BookOpen, 
  Clock, 
  Check, 
  X, 
  Package, 
  RotateCcw,
  Star,
  AlertTriangle,
  Inbox,
  Send,
  CheckSquare,
  History,
  ShieldAlert,
} from "lucide-react";

const STATUS_CONFIG: Record<LoanStatus, { label: string; color: string; icon: React.ReactNode }> = {
  requested: { label: "Pending", color: "bg-yellow-500/10 text-yellow-600", icon: <Clock className="h-3 w-3" /> },
  approved: { label: "Approved", color: "bg-blue-500/10 text-blue-600", icon: <Check className="h-3 w-3" /> },
  active: { label: "On Loan", color: "bg-green-500/10 text-green-600", icon: <BookOpen className="h-3 w-3" /> },
  returned: { label: "Returned", color: "bg-slate-500/10 text-slate-600", icon: <RotateCcw className="h-3 w-3" /> },
  declined: { label: "Declined", color: "bg-red-500/10 text-red-600", icon: <X className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", color: "bg-slate-500/10 text-slate-600", icon: <X className="h-3 w-3" /> },
};

function BorrowerReputationBadge({ userId }: { userId: string }) {
  const { data: rep, isLoading } = useQuery({
    queryKey: ["borrower-reputation", userId],
    queryFn: async () => {
      if (!userId || userId.trim() === "") return null;
      const { data, error } = await supabase
        .from("borrower_reputation")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as { user_id: string; total_ratings: number; average_rating: number; positive_ratings: number } | null;
    },
    enabled: !!userId && userId.trim() !== "",
  });

  if (isLoading || !rep) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            {rep.average_rating.toFixed(1)}
            <span className="text-muted-foreground">({rep.total_ratings})</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{rep.total_ratings} rating{rep.total_ratings !== 1 ? 's' : ''} · {rep.positive_ratings} positive</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface LendingDashboardProps {
  libraryId?: string;
}

export function LendingDashboard({ libraryId }: LendingDashboardProps) {
  const {
    myBorrowedLoans,
    myLentLoans,
    isLoading,
    approveLoan,
    declineLoan,
    markPickedUp,
    markReturned,
    cancelLoan,
    rateBorrower,
    bulkApproveLoan,
    bulkMarkReturned,
    useGameCopies,
    useLendingRules,
  } = useLending(libraryId);

  const [selectedLoan, setSelectedLoan] = useState<GameLoan | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'decline' | 'rate' | 'return' | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [selectedCopyId, setSelectedCopyId] = useState<string>("");
  const [conditionOut, setConditionOut] = useState("");
  const [conditionIn, setConditionIn] = useState("");
  const [damageReported, setDamageReported] = useState(false);
  const [selectedLoanIds, setSelectedLoanIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch copies for selected game when approving
  const { data: gameCopies = [] } = useGameCopies(
    actionType === 'approve' ? selectedLoan?.game_id : undefined
  );

  // Fetch lending rules
  const { data: lendingRules } = useLendingRules(libraryId);

  const handleAction = async () => {
    if (!selectedLoan) return;

    switch (actionType) {
      case 'approve':
        await approveLoan.mutateAsync({ 
          loanId: selectedLoan.id, 
          dueDate: dueDate || undefined,
          notes: notes || undefined,
          copyId: selectedCopyId || undefined,
          conditionOut: conditionOut || undefined,
        });
        break;
      case 'decline':
        await declineLoan.mutateAsync({ loanId: selectedLoan.id, notes: notes || undefined });
        break;
      case 'return':
        await markReturned.mutateAsync({
          loanId: selectedLoan.id,
          conditionIn: conditionIn || undefined,
          damageReported,
        });
        break;
      case 'rate':
        await rateBorrower.mutateAsync({
          loanId: selectedLoan.id,
          borrowerUserId: selectedLoan.borrower_user_id,
          rating,
          review: review || undefined,
        });
        break;
    }

    closeDialog();
  };

  const closeDialog = () => {
    setSelectedLoan(null);
    setActionType(null);
    setDueDate("");
    setNotes("");
    setRating(5);
    setReview("");
    setSelectedCopyId("");
    setConditionOut("");
    setConditionIn("");
    setDamageReported(false);
  };

  const openApproveDialog = (loan: GameLoan) => {
    setSelectedLoan(loan);
    setActionType('approve');
    // Auto-fill due date from library rules
    if (lendingRules?.default_loan_duration_days) {
      const due = addDays(new Date(), lendingRules.default_loan_duration_days);
      setDueDate(due.toISOString().split('T')[0]);
    }
  };

  const openReturnDialog = (loan: GameLoan) => {
    setSelectedLoan(loan);
    setActionType('return');
  };

  const toggleLoanSelection = (loanId: string) => {
    setSelectedLoanIds(prev => {
      const next = new Set(prev);
      if (next.has(loanId)) next.delete(loanId);
      else next.add(loanId);
      return next;
    });
  };

  const handleBulkApprove = async () => {
    if (selectedLoanIds.size === 0) return;
    await bulkApproveLoan.mutateAsync({ 
      loanIds: Array.from(selectedLoanIds),
      dueDate: lendingRules?.default_loan_duration_days 
        ? addDays(new Date(), lendingRules.default_loan_duration_days).toISOString()
        : undefined,
    });
    setSelectedLoanIds(new Set());
    setBulkMode(false);
  };

  const handleBulkReturn = async () => {
    if (selectedLoanIds.size === 0) return;
    await bulkMarkReturned.mutateAsync({ loanIds: Array.from(selectedLoanIds) });
    setSelectedLoanIds(new Set());
    setBulkMode(false);
  };

  const pendingRequests = myLentLoans.filter((l) => l.status === 'requested');
  const activeLoans = myLentLoans.filter((l) => ['approved', 'active'].includes(l.status));
  const overdueLoans = activeLoans.filter((l) => l.due_date && isPast(new Date(l.due_date)) && l.status === 'active');
  const historyLoans = myLentLoans.filter((l) => ['returned', 'declined', 'cancelled'].includes(l.status));

  // Build per-game inventory summary for owners
  const gameInventory = (() => {
    const map = new Map<string, { title: string; copiesOwned: number; activeCount: number }>();
    for (const loan of myLentLoans) {
      if (!loan.game) continue;
      const existing = map.get(loan.game_id);
      const isActive = ['requested', 'approved', 'active'].includes(loan.status);
      if (existing) {
        if (isActive) existing.activeCount++;
      } else {
        map.set(loan.game_id, {
          title: loan.game.title,
          copiesOwned: loan.game.copies_owned ?? 1,
          activeCount: isActive ? 1 : 0,
        });
      }
    }
    return Array.from(map.values()).filter((g) => g.activeCount > 0);
  })();

  const LoanCard = ({ loan, isLender }: { loan: GameLoan; isLender: boolean }) => {
    const config = STATUS_CONFIG[loan.status];
    const isOverdue = loan.due_date && isPast(new Date(loan.due_date)) && loan.status === 'active';

    return (
      <Card className={isOverdue ? "border-destructive/50" : ""}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-4">
            {/* Bulk select checkbox */}
            {bulkMode && isLender && ['requested', 'active'].includes(loan.status) && (
              <Checkbox
                checked={selectedLoanIds.has(loan.id)}
                onCheckedChange={() => toggleLoanSelection(loan.id)}
                className="mt-1"
              />
            )}

            {/* Game Image */}
            <div className="h-20 w-16 rounded overflow-hidden bg-muted flex-shrink-0">
              {loan.game?.image_url ? (
                <img
                  src={loan.game.image_url}
                  alt={loan.game.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Loan Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-semibold truncate">{loan.game?.title || "Unknown Game"}</h4>
                <Badge className={`${config.color} gap-1 flex-shrink-0`}>
                  {config.icon}
                  {config.label}
                </Badge>
              </div>
              
              <div className="text-sm text-muted-foreground mb-1">
                {isLender ? (
                  <span className="flex items-center gap-2">
                    Borrower
                    <BorrowerReputationBadge userId={loan.borrower_user_id} />
                  </span>
                ) : (
                  <span>
                    From: <span className="font-medium text-foreground">{loan.library?.name || "Unknown Library"}</span>
                  </span>
                )}
              </div>

              {/* Copy info */}
              {loan.copy && (
                <p className="text-xs text-muted-foreground">
                  Copy #{loan.copy.copy_number}{loan.copy.copy_label ? ` — ${loan.copy.copy_label}` : ""}
                </p>
              )}

              {loan.due_date && (
                <p className={`text-xs mt-1 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {isOverdue ? (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Overdue by {formatDistanceToNow(new Date(loan.due_date))}
                    </span>
                  ) : (
                    <>Due: {format(new Date(loan.due_date), "MMM d, yyyy")}</>
                  )}
                </p>
              )}

              {loan.borrower_notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  "{loan.borrower_notes}"
                </p>
              )}

              {/* Condition tracking info */}
              {loan.condition_out && (
                <p className="text-xs text-muted-foreground mt-1">
                  Condition out: {loan.condition_out}
                </p>
              )}
              {loan.condition_in && (
                <p className="text-xs text-muted-foreground mt-1">
                  Condition in: {loan.condition_in}
                </p>
              )}
              {loan.damage_reported && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Damage reported
                </p>
              )}

              {loan.lender_notes && isLender && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your notes: {loan.lender_notes}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          {!bulkMode && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              {isLender && loan.status === 'requested' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => openApproveDialog(loan)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedLoan(loan);
                      setActionType('decline');
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </>
              )}

              {isLender && loan.status === 'approved' && (
                <Button
                  size="sm"
                  onClick={() => markPickedUp.mutate({ loanId: loan.id })}
                >
                  <Package className="h-4 w-4 mr-1" />
                  Mark Picked Up
                </Button>
              )}

              {isLender && loan.status === 'active' && (
                <Button
                  size="sm"
                  onClick={() => openReturnDialog(loan)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Mark Returned
                </Button>
              )}

              {isLender && loan.status === 'returned' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedLoan(loan);
                    setActionType('rate');
                  }}
                >
                  <Star className="h-4 w-4 mr-1" />
                  Rate Borrower
                </Button>
              )}

              {!isLender && loan.status === 'requested' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cancelLoan.mutate({ loanId: loan.id })}
                >
                  Cancel Request
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex gap-4">
                <Skeleton className="h-20 w-16" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="lending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lending" className="gap-2">
            <Send className="h-4 w-4" />
            My Lending
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="borrowing" className="gap-2">
            <Inbox className="h-4 w-4" />
            My Borrowing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lending" className="space-y-4">
          {/* Overdue Alert */}
          {overdueLoans.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  {overdueLoans.length} Overdue {overdueLoans.length === 1 ? 'Loan' : 'Loans'}
                </div>
                <div className="space-y-1">
                  {overdueLoans.map((loan) => (
                    <div key={loan.id} className="flex items-center justify-between text-sm">
                      <span className="truncate mr-2">{loan.game?.title}</span>
                      <span className="text-destructive text-xs whitespace-nowrap">
                        {loan.due_date && formatDistanceToNow(new Date(loan.due_date))} overdue
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Inventory Overview */}
          {gameInventory.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Inventory Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1">
                  {gameInventory.map((g) => (
                    <div key={g.title} className="flex items-center justify-between text-sm">
                      <span className="truncate mr-2">{g.title}</span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {Math.max(0, g.copiesOwned - g.activeCount)}/{g.copiesOwned} available
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bulk actions bar */}
          {(pendingRequests.length > 1 || activeLoans.length > 1) && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={bulkMode ? "secondary" : "outline"}
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setSelectedLoanIds(new Set());
                }}
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                {bulkMode ? "Cancel Bulk" : "Bulk Actions"}
              </Button>
              {bulkMode && selectedLoanIds.size > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedLoanIds.size} selected
                  </span>
                  {pendingRequests.some(l => selectedLoanIds.has(l.id)) && (
                    <Button size="sm" onClick={handleBulkApprove} disabled={bulkApproveLoan.isPending}>
                      <Check className="h-4 w-4 mr-1" />
                      Approve Selected
                    </Button>
                  )}
                  {activeLoans.some(l => selectedLoanIds.has(l.id) && l.status === 'active') && (
                    <Button size="sm" variant="outline" onClick={handleBulkReturn} disabled={bulkMarkReturned.isPending}>
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Return Selected
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Pending Requests
              </h3>
              {pendingRequests.map((loan) => (
                <LoanCard key={loan.id} loan={loan} isLender />
              ))}
            </div>
          )}

          {activeLoans.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Active Loans
              </h3>
              {activeLoans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} isLender />
              ))}
            </div>
          )}

          {historyLoans.length > 0 && (
            <div className="space-y-3">
              <button 
                className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="h-4 w-4" />
                History ({historyLoans.length})
              </button>
              {showHistory && historyLoans.slice(0, 20).map((loan) => (
                <LoanCard key={loan.id} loan={loan} isLender />
              ))}
            </div>
          )}

          {myLentLoans.length === 0 && (
            <div className="text-center py-12">
              <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No loan requests</h3>
              <p className="text-muted-foreground">
                When someone requests to borrow a game, it will appear here
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="borrowing" className="space-y-4">
          {myBorrowedLoans.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No borrowed games</h3>
              <p className="text-muted-foreground">
                Browse the library directory to find games to borrow
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myBorrowedLoans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} isLender={false} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && "Approve Loan Request"}
              {actionType === 'decline' && "Decline Loan Request"}
              {actionType === 'return' && "Mark as Returned"}
              {actionType === 'rate' && "Rate Borrower"}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' && `Approve "${selectedLoan?.game?.title}" to be borrowed`}
              {actionType === 'decline' && `Decline the request for "${selectedLoan?.game?.title}"`}
              {actionType === 'return' && `Record the return of "${selectedLoan?.game?.title}"`}
              {actionType === 'rate' && "Leave feedback for the borrower"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* APPROVE: Copy selection */}
            {actionType === 'approve' && gameCopies.length > 0 && (
              <div className="space-y-2">
                <Label>Assign Copy (optional)</Label>
                <Select value={selectedCopyId} onValueChange={setSelectedCopyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a copy..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific copy</SelectItem>
                    {gameCopies.map((copy) => (
                      <SelectItem key={copy.id} value={copy.id}>
                        Copy #{copy.copy_number}
                        {copy.copy_label ? ` — ${copy.copy_label}` : ""}
                        {copy.condition ? ` (${copy.condition})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* APPROVE: Condition out */}
            {actionType === 'approve' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="conditionOut">Game Condition at Checkout</Label>
                  <Input
                    id="conditionOut"
                    value={conditionOut}
                    onChange={(e) => setConditionOut(e.target.value)}
                    placeholder="e.g. Excellent, all components present"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {lendingRules?.default_loan_duration_days && (
                    <p className="text-xs text-muted-foreground">
                      Default: {lendingRules.default_loan_duration_days} days
                    </p>
                  )}
                </div>
              </>
            )}

            {/* RETURN: Condition in */}
            {actionType === 'return' && (
              <>
                {selectedLoan?.condition_out && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Condition when lent: </span>
                    <span className="font-medium">{selectedLoan.condition_out}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="conditionIn">Game Condition at Return</Label>
                  <Input
                    id="conditionIn"
                    value={conditionIn}
                    onChange={(e) => setConditionIn(e.target.value)}
                    placeholder="e.g. Good, minor box wear"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="damageReported"
                    checked={damageReported}
                    onCheckedChange={(checked) => setDamageReported(!!checked)}
                  />
                  <Label htmlFor="damageReported" className="text-sm font-normal">
                    Report damage or missing components
                  </Label>
                </div>
              </>
            )}

            {/* RATE: Stars */}
            {actionType === 'rate' && (
              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => setRating(value)}
                      className={`p-1 ${value <= rating ? "text-yellow-500" : "text-muted-foreground"}`}
                    >
                      <Star className="h-6 w-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes field (all action types) */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {actionType === 'rate' ? "Review (optional)" : "Notes (optional)"}
              </Label>
              <Textarea
                id="notes"
                value={actionType === 'rate' ? review : notes}
                onChange={(e) => actionType === 'rate' ? setReview(e.target.value) : setNotes(e.target.value)}
                placeholder={
                  actionType === 'approve' ? "Pickup instructions, special handling notes..." :
                  actionType === 'decline' ? "Reason for declining..." :
                  actionType === 'return' ? "Return notes..." :
                  "How was the borrower?"
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleAction}
              variant={actionType === 'decline' ? 'destructive' : 'default'}
              disabled={
                approveLoan.isPending || declineLoan.isPending || 
                markReturned.isPending || rateBorrower.isPending
              }
            >
              {actionType === 'approve' && "Approve"}
              {actionType === 'decline' && "Decline"}
              {actionType === 'return' && "Confirm Return"}
              {actionType === 'rate' && "Submit Rating"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
