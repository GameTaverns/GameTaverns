import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, BookOpen, RotateCcw, Clock, AlertTriangle,
  Users, Package, ChevronDown, ChevronUp, ScanBarcode,
} from "lucide-react";
import { useClubLoans, useClubLendingSettings } from "@/hooks/useClubLending";
import { useClubGameSearch } from "@/hooks/useClubs";
import { useDebounce } from "@/hooks/useDebounce";
import { useBarcodeLookup } from "@/hooks/useBarcodeScanner";
import { ClubCheckoutDialog } from "./ClubCheckoutDialog";
import { ClubReturnDialog } from "./ClubReturnDialog";
import { BarcodeScannerDialog } from "./BarcodeScannerDialog";
import { BarcodeLinkDialog } from "./BarcodeLinkDialog";
import type { ClubLoan } from "@/hooks/useClubLending";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ClubLendingDeskProps {
  clubId: string;
  staffUserId: string;
}

export function ClubLendingDesk({ clubId, staffUserId }: ClubLendingDeskProps) {
  const [gameSearch, setGameSearch] = useState("");
  const [loanSearch, setLoanSearch] = useState("");
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [showBarcodeLink, setShowBarcodeLink] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState("");
  const debouncedGameSearch = useDebounce(gameSearch, 300);

  const { data: settings } = useClubLendingSettings(clubId);
  const { data: activeLoans = [], isLoading: activeLoading } = useClubLoans(clubId, "checked_out");
  const { data: returnedLoans = [] } = useClubLoans(clubId, "returned");
  const { data: searchResults = [] } = useClubGameSearch(clubId, debouncedGameSearch);
  const { data: barcodeMatch, isLoading: barcodeLoading } = useBarcodeLookup(scannedBarcode);

  const [checkoutGame, setCheckoutGame] = useState<any>(null);
  const [returnLoan, setReturnLoan] = useState<ClubLoan | null>(null);
  const { toast } = useToast();

  // When barcode lookup resolves, either checkout the game or prompt linking
  const handleBarcodeScan = (barcode: string) => {
    setScannedBarcode(barcode);
  };

  // Effect-like: react to barcode match changes
  useMemo(() => {
    if (!scannedBarcode || barcodeLoading) return;
    if (barcodeMatch?.game) {
      // Found a linked game — go straight to checkout
      setCheckoutGame({
        ...barcodeMatch.game,
        library_id: barcodeMatch.game.library_id,
      });
      toast({ title: "Game found!", description: `Barcode matched: ${barcodeMatch.game.title}` });
      setScannedBarcode(null);
    } else if (barcodeMatch === null && scannedBarcode) {
      // Unknown barcode — show link dialog
      setPendingBarcode(scannedBarcode);
      setShowBarcodeLink(true);
      setScannedBarcode(null);
    }
  }, [barcodeMatch, barcodeLoading, scannedBarcode]);

  const isOverdue = (loan: ClubLoan) =>
    loan.status === "checked_out" && loan.due_at && new Date(loan.due_at) < new Date();

  const overdueLoans = useMemo(() => activeLoans.filter(isOverdue), [activeLoans]);
  const onTimeLoans = useMemo(
    () => activeLoans.filter((l) => !isOverdue(l)),
    [activeLoans]
  );

  // Filter active loans by borrower name search
  const filteredActive = useMemo(() => {
    if (!loanSearch.trim()) return activeLoans;
    const q = loanSearch.toLowerCase();
    return activeLoans.filter(
      (l) =>
        (l.guest_name && l.guest_name.toLowerCase().includes(q)) ||
        (l.borrower_profile?.display_name &&
          l.borrower_profile.display_name.toLowerCase().includes(q)) ||
        (l.game?.title && l.game.title.toLowerCase().includes(q))
    );
  }, [activeLoans, loanSearch]);

  const uniqueBorrowers = useMemo(() => {
    const set = new Set<string>();
    activeLoans.forEach((l) => {
      set.add(l.guest_name || l.borrower_profile?.display_name || "Unknown");
    });
    return set.size;
  }, [activeLoans]);

  return (
    <div className="space-y-6">
      {/* ── Header Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<BookOpen className="h-5 w-5 text-secondary" />}
          value={activeLoans.length}
          label="Checked Out"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-400" />}
          value={overdueLoans.length}
          label="Overdue"
          highlight={overdueLoans.length > 0}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-400" />}
          value={uniqueBorrowers}
          label="Active Borrowers"
        />
        <StatCard
          icon={<Package className="h-5 w-5 text-green-400" />}
          value={returnedLoans.length}
          label="Returned Today"
        />
      </div>

      {/* ── Quick Checkout Search ── */}
      <Card className="bg-secondary/10 border-secondary/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <BookOpen className="h-5 w-5 text-secondary shrink-0" />
            <h3 className="font-display text-lg text-foreground font-semibold">
              Quick Checkout
            </h3>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search a game title to check out..."
                className="pl-10 h-12 text-base bg-background border-border"
                value={gameSearch}
                onChange={(e) => setGameSearch(e.target.value)}
                autoFocus
              />
            </div>
            <Button
              size="lg"
              variant="outline"
              className="h-12 gap-2 px-4 border-secondary/50 hover:bg-secondary/10"
              onClick={() => setShowScanner(true)}
            >
              <ScanBarcode className="h-5 w-5" />
              <span className="hidden sm:inline">Scan</span>
            </Button>
          </div>
          {debouncedGameSearch && searchResults.length > 0 && (
            <div className="mt-3 max-h-64 overflow-y-auto space-y-1 rounded-lg border border-border bg-background p-1">
              {searchResults.slice(0, 12).map((game: any) => (
                <button
                  key={game.id}
                  className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent/50 text-left transition-colors"
                  onClick={() => {
                    setCheckoutGame(game);
                    setGameSearch("");
                  }}
                >
                  {game.image_url && (
                    <img
                      src={game.image_url}
                      alt=""
                      className="h-10 w-10 rounded object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">
                      {game.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {game.library_name} · {game.owner_name}
                    </p>
                  </div>
                  <Button size="sm" className="shrink-0 gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    Check Out
                  </Button>
                </button>
              ))}
            </div>
          )}
          {debouncedGameSearch && searchResults.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground text-center py-4">
              No games found matching "{debouncedGameSearch}"
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Active Loans ── */}
      <Tabs defaultValue="active" className="w-full">
        <div className="flex items-center justify-between gap-4 mb-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="active" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Active ({activeLoans.length})
            </TabsTrigger>
            <TabsTrigger value="returned" className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Returned ({returnedLoans.length})
            </TabsTrigger>
          </TabsList>
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter by name or game..."
              className="pl-9 h-9 text-sm bg-background"
              value={loanSearch}
              onChange={(e) => setLoanSearch(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value="active" className="mt-0">
          {/* Overdue section first */}
          {overdueLoans.length > 0 && !loanSearch && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-destructive flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-4 w-4" />
                Overdue ({overdueLoans.length})
              </h4>
              <div className="space-y-2">
                {overdueLoans.map((loan) => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    isOverdue
                    expanded={expandedLoanId === loan.id}
                    onToggleExpand={() =>
                      setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)
                    }
                    onReturn={() => setReturnLoan(loan)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* On-time loans */}
          {activeLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : (loanSearch ? filteredActive : onTimeLoans).length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                {loanSearch
                  ? "No loans match your search"
                  : "No active checkouts — use Quick Checkout above to get started"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(loanSearch ? filteredActive.filter((l) => !isOverdue(l)) : onTimeLoans).map(
                (loan) => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    isOverdue={false}
                    expanded={expandedLoanId === loan.id}
                    onToggleExpand={() =>
                      setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)
                    }
                    onReturn={() => setReturnLoan(loan)}
                  />
                )
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="returned" className="mt-0">
          {returnedLoans.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No returned loans yet
            </p>
          ) : (
            <div className="space-y-2">
              {returnedLoans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  isOverdue={false}
                  expanded={expandedLoanId === loan.id}
                  onToggleExpand={() =>
                    setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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

      {/* Barcode Scanner */}
      <BarcodeScannerDialog
        open={showScanner}
        onOpenChange={setShowScanner}
        onScan={handleBarcodeScan}
        title="Scan Game Barcode"
        description="Point your camera at the UPC/EAN barcode on the game box, or type it manually."
      />

      {/* Barcode Link (for unknown barcodes) */}
      {pendingBarcode && (
        <BarcodeLinkDialog
          open={showBarcodeLink}
          onOpenChange={(open) => {
            setShowBarcodeLink(open);
            if (!open) setPendingBarcode("");
          }}
          barcode={pendingBarcode}
          clubId={clubId}
          userId={staffUserId}
          onLinked={(game) => {
            setCheckoutGame(game);
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ──

function StatCard({
  icon,
  value,
  label,
  highlight,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`border ${
        highlight
          ? "bg-destructive/10 border-destructive/30"
          : "bg-card border-border"
      }`}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <div>
          <p className="text-2xl font-display font-bold text-foreground">
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LoanCard({
  loan,
  isOverdue,
  expanded,
  onToggleExpand,
  onReturn,
}: {
  loan: ClubLoan;
  isOverdue: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onReturn?: () => void;
}) {
  const borrowerLabel =
    loan.guest_name || loan.borrower_profile?.display_name || "Unknown";
  const gameTitle = loan.game?.title || "Unknown Game";
  const isReturned = loan.status === "returned";

  const timeInfo = isReturned
    ? loan.returned_at
      ? `Returned ${formatDistanceToNow(new Date(loan.returned_at), { addSuffix: true })}`
      : "Returned"
    : loan.due_at
      ? isOverdue
        ? `Overdue by ${formatDistanceToNow(new Date(loan.due_at))}`
        : `Due ${formatDistanceToNow(new Date(loan.due_at), { addSuffix: true })}`
      : "No due date";

  return (
    <Card
      className={`border transition-colors ${
        isOverdue
          ? "bg-destructive/5 border-destructive/30"
          : isReturned
            ? "bg-muted/30 border-border"
            : "bg-card border-border"
      }`}
    >
      <CardContent className="p-0">
        {/* Main row */}
        <div className="flex items-center gap-3 p-3 sm:p-4">
          {loan.game?.image_url ? (
            <img
              src={loan.game.image_url}
              alt=""
              className="h-12 w-12 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-foreground truncate">
              {gameTitle}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              → {borrowerLabel}
              {loan.guest_contact && (
                <span className="text-xs ml-1 opacity-70">
                  ({loan.guest_contact})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Time badge */}
            <Badge
              variant={isOverdue ? "destructive" : isReturned ? "secondary" : "outline"}
              className="hidden sm:flex gap-1 text-xs"
            >
              <Clock className="h-3 w-3" />
              {timeInfo}
            </Badge>

            {/* Return button */}
            {!isReturned && onReturn && (
              <Button
                size="sm"
                onClick={onReturn}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Return
              </Button>
            )}

            {/* Expand toggle */}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onToggleExpand}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile time badge */}
        <div className="sm:hidden px-3 pb-2">
          <Badge
            variant={isOverdue ? "destructive" : isReturned ? "secondary" : "outline"}
            className="gap-1 text-xs"
          >
            <Clock className="h-3 w-3" />
            {timeInfo}
          </Badge>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-border px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Checked Out</p>
              <p className="text-foreground">
                {format(new Date(loan.checked_out_at), "MMM d, h:mm a")}
              </p>
            </div>
            {loan.due_at && (
              <div>
                <p className="text-xs text-muted-foreground">Due</p>
                <p className="text-foreground">
                  {format(new Date(loan.due_at), "MMM d, h:mm a")}
                </p>
              </div>
            )}
            {loan.condition_out && (
              <div>
                <p className="text-xs text-muted-foreground">Condition Out</p>
                <p className="text-foreground">{loan.condition_out}</p>
              </div>
            )}
            {loan.condition_in && (
              <div>
                <p className="text-xs text-muted-foreground">Condition In</p>
                <p className="text-foreground">{loan.condition_in}</p>
              </div>
            )}
            {loan.notes && (
              <div className="col-span-2 sm:col-span-4">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-foreground">{loan.notes}</p>
              </div>
            )}
            {loan.library && (
              <div>
                <p className="text-xs text-muted-foreground">From Library</p>
                <p className="text-foreground">{loan.library.name}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
