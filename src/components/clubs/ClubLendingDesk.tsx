import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, BookOpen, RotateCcw, Clock, AlertTriangle } from "lucide-react";
import { useClubLoans, useClubLendingSettings } from "@/hooks/useClubLending";
import { useClubGameSearch } from "@/hooks/useClubs";
import { useDebounce } from "@/hooks/useDebounce";
import { ClubCheckoutDialog } from "./ClubCheckoutDialog";
import { ClubReturnDialog } from "./ClubReturnDialog";
import type { ClubLoan } from "@/hooks/useClubLending";
import { format } from "date-fns";

interface ClubLendingDeskProps {
  clubId: string;
  staffUserId: string;
}

export function ClubLendingDesk({ clubId, staffUserId }: ClubLendingDeskProps) {
  const [statusFilter, setStatusFilter] = useState("checked_out");
  const [gameSearch, setGameSearch] = useState("");
  const debouncedSearch = useDebounce(gameSearch, 300);

  const { data: settings } = useClubLendingSettings(clubId);
  const { data: loans = [], isLoading: loansLoading } = useClubLoans(clubId, statusFilter);
  const { data: searchResults = [] } = useClubGameSearch(clubId, debouncedSearch);

  const [checkoutGame, setCheckoutGame] = useState<any>(null);
  const [returnLoan, setReturnLoan] = useState<ClubLoan | null>(null);

  const activeCount = loans.filter((l) => l.status === "checked_out").length;

  const isOverdue = (loan: ClubLoan) =>
    loan.status === "checked_out" && loan.due_at && new Date(loan.due_at) < new Date();

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
          <CardContent className="p-4 text-center">
            <BookOpen className="h-5 w-5 mx-auto mb-1 text-secondary" />
            <p className="text-2xl font-display font-bold">
              {statusFilter === "checked_out" ? loans.length : activeCount}
            </p>
            <p className="text-xs text-cream/60">Active Loans</p>
          </CardContent>
        </Card>
        <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-amber-400" />
            <p className="text-2xl font-display font-bold">
              {loans.filter(isOverdue).length}
            </p>
            <p className="text-xs text-cream/60">Overdue</p>
          </CardContent>
        </Card>
        <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream col-span-2">
          <CardContent className="p-4">
            <p className="text-xs text-cream/60 mb-2">Quick Checkout</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/50" />
              <Input
                placeholder="Search games to check out..."
                className="pl-10 bg-wood-dark/50 border-wood-medium/50 text-cream placeholder:text-cream/40"
                value={gameSearch}
                onChange={(e) => setGameSearch(e.target.value)}
              />
            </div>
            {debouncedSearch && searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1 rounded-md border border-wood-medium/40 bg-wood-dark/80 p-1">
                {searchResults.slice(0, 10).map((game: any) => (
                  <button
                    key={game.id}
                    className="w-full flex items-center gap-3 p-2 rounded hover:bg-wood-medium/40 text-left"
                    onClick={() => {
                      setCheckoutGame(game);
                      setGameSearch("");
                    }}
                  >
                    {game.image_url && (
                      <img
                        src={game.image_url}
                        alt=""
                        className="h-8 w-8 rounded object-cover shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-cream truncate">{game.title}</p>
                      <p className="text-xs text-cream/50">{game.library_name}</p>
                    </div>
                    <Button size="sm" variant="secondary" className="ml-auto shrink-0">
                      <BookOpen className="h-3 w-3 mr-1" /> Checkout
                    </Button>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loan List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg text-cream">Loan Records</h3>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-wood-dark/50 border-wood-medium/50 text-cream">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checked_out">Active</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loansLoading ? (
          <p className="text-cream/50 text-center py-8">Loading...</p>
        ) : loans.length === 0 ? (
          <p className="text-cream/50 text-center py-8">
            No {statusFilter === "all" ? "" : statusFilter.replace("_", " ")} loans.
          </p>
        ) : (
          <div className="space-y-2">
            {loans.map((loan) => (
              <Card
                key={loan.id}
                className={`border text-cream ${
                  isOverdue(loan)
                    ? "bg-red-950/30 border-red-500/40"
                    : "bg-wood-medium/30 border-wood-medium/50"
                }`}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  {loan.game?.image_url && (
                    <img
                      src={loan.game.image_url}
                      alt=""
                      className="h-12 w-12 rounded object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold truncate">
                      {loan.game?.title || "Unknown Game"}
                    </p>
                    <p className="text-sm text-cream/60">
                      → {loan.guest_name || loan.borrower_profile?.display_name || "Unknown"}
                      {loan.guest_contact && ` (${loan.guest_contact})`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-cream/40">
                        Out: {format(new Date(loan.checked_out_at), "MMM d, h:mm a")}
                      </span>
                      {loan.due_at && (
                        <span className="text-xs text-cream/40">
                          · Due: {format(new Date(loan.due_at), "MMM d, h:mm a")}
                        </span>
                      )}
                      {loan.condition_out && (
                        <Badge variant="outline" className="text-xs">
                          {loan.condition_out}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOverdue(loan) && (
                      <Badge variant="destructive" className="gap-1">
                        <Clock className="h-3 w-3" /> Overdue
                      </Badge>
                    )}
                    {loan.status === "checked_out" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setReturnLoan(loan)}
                        className="gap-1"
                      >
                        <RotateCcw className="h-3 w-3" /> Return
                      </Button>
                    ) : (
                      <Badge variant="secondary">Returned</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {checkoutGame && settings && (
        <ClubCheckoutDialog
          open={!!checkoutGame}
          onOpenChange={(open) => !open && setCheckoutGame(null)}
          clubId={clubId}
          game={checkoutGame}
          staffUserId={staffUserId}
          defaultDurationHours={settings.default_duration_hours}
          requireContact={settings.require_contact_info}
        />
      )}

      {returnLoan && (
        <ClubReturnDialog
          open={!!returnLoan}
          onOpenChange={(open) => !open && setReturnLoan(null)}
          loan={returnLoan}
        />
      )}
    </div>
  );
}
