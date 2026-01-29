import { useState } from "react";
import { useLending, type GameLoan, type LoanStatus } from "@/hooks/useLending";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, formatDistanceToNow, isPast } from "date-fns";
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
  Send
} from "lucide-react";

const STATUS_CONFIG: Record<LoanStatus, { label: string; color: string; icon: React.ReactNode }> = {
  requested: { label: "Pending", color: "bg-yellow-500/10 text-yellow-600", icon: <Clock className="h-3 w-3" /> },
  approved: { label: "Approved", color: "bg-blue-500/10 text-blue-600", icon: <Check className="h-3 w-3" /> },
  active: { label: "On Loan", color: "bg-green-500/10 text-green-600", icon: <BookOpen className="h-3 w-3" /> },
  returned: { label: "Returned", color: "bg-slate-500/10 text-slate-600", icon: <RotateCcw className="h-3 w-3" /> },
  declined: { label: "Declined", color: "bg-red-500/10 text-red-600", icon: <X className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", color: "bg-slate-500/10 text-slate-600", icon: <X className="h-3 w-3" /> },
};

export function LendingDashboard() {
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
  } = useLending();

  const [selectedLoan, setSelectedLoan] = useState<GameLoan | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'decline' | 'rate' | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");

  const handleAction = async () => {
    if (!selectedLoan) return;

    switch (actionType) {
      case 'approve':
        await approveLoan.mutateAsync({ 
          loanId: selectedLoan.id, 
          dueDate: dueDate || undefined,
          notes: notes || undefined 
        });
        break;
      case 'decline':
        await declineLoan.mutateAsync({ loanId: selectedLoan.id, notes: notes || undefined });
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
  };

  const pendingRequests = myLentLoans.filter((l) => l.status === 'requested');
  const activeLoans = myLentLoans.filter((l) => ['approved', 'active'].includes(l.status));

  const LoanCard = ({ loan, isLender }: { loan: GameLoan; isLender: boolean }) => {
    const config = STATUS_CONFIG[loan.status];
    const isOverdue = loan.due_date && isPast(new Date(loan.due_date)) && loan.status === 'active';

    return (
      <Card className={isOverdue ? "border-red-500/50" : ""}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-4">
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
              
              <p className="text-sm text-muted-foreground mb-2">
                {isLender ? "Borrower" : "From"}: {loan.library?.name || "Unknown"}
              </p>

              {loan.due_date && (
                <p className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
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
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
            {isLender && loan.status === 'requested' && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedLoan(loan);
                    setActionType('approve');
                  }}
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
                onClick={() => markReturned.mutate({ loanId: loan.id })}
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

          {myLentLoans.filter((l) => l.status === 'returned').length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                History
              </h3>
              {myLentLoans
                .filter((l) => l.status === 'returned')
                .slice(0, 5)
                .map((loan) => (
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && "Approve Loan Request"}
              {actionType === 'decline' && "Decline Loan Request"}
              {actionType === 'rate' && "Rate Borrower"}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' && `Approve ${selectedLoan?.game?.title} to be borrowed`}
              {actionType === 'decline' && `Decline the request for ${selectedLoan?.game?.title}`}
              {actionType === 'rate' && "Leave feedback for the borrower"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {actionType === 'approve' && (
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date (optional)</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}

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

            <div className="space-y-2">
              <Label htmlFor="notes">
                {actionType === 'rate' ? "Review (optional)" : "Notes (optional)"}
              </Label>
              <Textarea
                id="notes"
                value={actionType === 'rate' ? review : notes}
                onChange={(e) => actionType === 'rate' ? setReview(e.target.value) : setNotes(e.target.value)}
                placeholder={
                  actionType === 'approve' ? "Any special instructions..." :
                  actionType === 'decline' ? "Reason for declining..." :
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
            >
              {actionType === 'approve' && "Approve"}
              {actionType === 'decline' && "Decline"}
              {actionType === 'rate' && "Submit Rating"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
