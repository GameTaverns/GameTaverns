import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight, CheckCircle, Star, Search, Package, Gamepad2, ScanLine,
  Clock, RotateCcw, CalendarClock, Hourglass, ChevronRight, Timer, Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const CONDITIONS = ["mint", "great", "good", "fair", "poor"] as const;

interface Props {
  event: any;
  activeLoans: any[];
  libraryGames: any[];
  conventionSettings: any;
  reservations?: any[];
}

export function ConventionLendingDesk({ event, activeLoans, libraryGames, conventionSettings, reservations = [] }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [subView, setSubView] = useState<"checkout" | "return">("checkout");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [guestName, setGuestName] = useState("");
  const [conditionOut, setConditionOut] = useState<string>("good");
  const [returnSearch, setReturnSearch] = useState("");
  const [conditionInMap, setConditionInMap] = useState<Record<string, string>>({});
  const [ratingMap, setRatingMap] = useState<Record<string, number>>({});

  // Compute availability
  const gameAvailability = libraryGames.map((g: any) => {
    const loansOut = activeLoans.filter((l: any) => l.game_id === g.id).length;
    return { ...g, loansOut, available: Math.max(0, (g.copies_owned || 1) - loansOut) };
  });

  const filteredGames = searchQuery.trim()
    ? gameAvailability.filter((g: any) => g.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const filteredLoans = returnSearch.trim()
    ? activeLoans.filter((l: any) =>
        l.game?.title?.toLowerCase().includes(returnSearch.toLowerCase()) ||
        l.guest_name?.toLowerCase().includes(returnSearch.toLowerCase())
      )
    : activeLoans;

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGame || !guestName.trim()) throw new Error("Missing game or borrower");
      const clubId = conventionSettings?.club_id;
      if (!clubId) throw new Error("No club configured for this convention");

      const { error } = await supabase.from("club_loans").insert({
        club_id: clubId,
        library_id: event.library_id,
        game_id: selectedGame.id,
        checked_out_by: user!.id,
        guest_name: guestName.trim(),
        status: "checked_out",
        condition_out: conditionOut,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Checked out "${selectedGame.title}" to ${guestName}`);
      setSelectedGame(null);
      setGuestName("");
      setSearchQuery("");
      setConditionOut("good");
      queryClient.invalidateQueries({ queryKey: ["convention-active-loans"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Return mutation
  const returnMutation = useMutation({
    mutationFn: async (loanId: string) => {
      const condIn = conditionInMap[loanId] || "good";
      const { error } = await supabase
        .from("club_loans")
        .update({
          status: "returned",
          returned_at: new Date().toISOString(),
          condition_in: condIn,
        })
        .eq("id", loanId);
      if (error) throw error;
    },
    onSuccess: (_, loanId) => {
      toast.success("Game returned successfully");
      setConditionInMap(prev => { const n = { ...prev }; delete n[loanId]; return n; });
      setRatingMap(prev => { const n = { ...prev }; delete n[loanId]; return n; });
      queryClient.invalidateQueries({ queryKey: ["convention-active-loans"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Stat bar
  const overdueLoans = activeLoans.filter((l: any) => l.due_at && new Date(l.due_at) < new Date());
  const totalAvailable = gameAvailability.reduce((s: number, g: any) => s + g.available, 0);
  const totalCopies = libraryGames.reduce((s: number, g: any) => s + (g.copies_owned || 1), 0);

  return (
    <div className="space-y-4">
      {/* Stat Bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Active Loans", value: activeLoans.length, icon: Clock, color: "text-primary" },
          { label: "Reservations", value: reservations.length, icon: CalendarClock, color: "text-secondary" },
          { label: "Available", value: `${totalAvailable}/${totalCopies}`, icon: Package, color: "text-accent" },
          { label: "Overdue", value: overdueLoans.length, icon: Timer, color: "text-destructive" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border/60">
            <s.icon className={`h-4 w-4 ${s.color}`} />
            <div>
              <p className="text-lg font-display leading-tight">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Split-pane: Left = checkout/return + reservations, Right = live loans */}
      <div className="grid lg:grid-cols-5 gap-4" style={{ minHeight: 520 }}>
        {/* Left Pane */}
        <div className="lg:col-span-2 space-y-3">
          {/* Checkout/Return toggle */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={subView === "checkout" ? "default" : "ghost"}
              size="sm"
              className="flex-1 text-xs gap-1"
              onClick={() => setSubView("checkout")}
            >
              <ArrowRight className="h-3.5 w-3.5" /> Check Out
            </Button>
            <Button
              variant={subView === "return" ? "default" : "ghost"}
              size="sm"
              className="flex-1 text-xs gap-1"
              onClick={() => setSubView("return")}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Return
            </Button>
          </div>

          <Card className="border-primary/20">
            <CardContent className="pt-4">
              {subView === "checkout" ? (
                /* Checkout Form */
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search game name or scan barcode..."
                      className="pl-9 h-10"
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setSelectedGame(null); }}
                      autoFocus
                    />
                  </div>

                  {filteredGames.length > 0 && !selectedGame && (
                    <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2 bg-background">
                      {filteredGames.slice(0, 8).map((g: any) => (
                        <button
                          key={g.id}
                          className="w-full text-left p-2 rounded hover:bg-muted flex items-center justify-between"
                          onClick={() => { setSelectedGame(g); setSearchQuery(g.title); }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-muted flex items-center justify-center overflow-hidden">
                              {g.image_url ? <img src={g.image_url} alt="" className="w-full h-full object-cover" /> : <Gamepad2 className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                            <span className="text-sm font-medium">{g.title}</span>
                          </div>
                          <Badge variant={g.available > 0 ? "secondary" : "destructive"} className="text-[10px]">
                            {g.available > 0 ? `${g.available} avail` : "All out"}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedGame ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-muted overflow-hidden flex items-center justify-center">
                          {selectedGame.image_url ? <img src={selectedGame.image_url} alt="" className="w-full h-full object-cover" /> : <Gamepad2 className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{selectedGame.title}</p>
                          <p className="text-xs text-muted-foreground">{selectedGame.available} of {selectedGame.copies_owned || 1} available</p>
                        </div>
                      </div>
                      <Input
                        placeholder="Borrower name or badge ID..."
                        className="h-10"
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Condition Out</span>
                        <Select value={conditionOut} onValueChange={setConditionOut}>
                          <SelectTrigger className="w-28 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONDITIONS.map(c => (
                              <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        className="w-full"
                        disabled={!guestName.trim() || selectedGame.available <= 0 || checkoutMutation.isPending}
                        onClick={() => checkoutMutation.mutate()}
                      >
                        <ArrowRight className="h-4 w-4 mr-1.5" />
                        {checkoutMutation.isPending ? "Checking out..." : "Confirm Checkout"}
                      </Button>
                    </div>
                  ) : (
                    !searchQuery.trim() && (
                      <div className="p-4 rounded-lg border-2 border-dashed border-border flex flex-col items-center gap-1.5 text-muted-foreground">
                        <ScanLine className="h-6 w-6" />
                        <p className="text-xs">Select a game to begin</p>
                      </div>
                    )
                  )}
                </div>
              ) : (
                /* Return Form */
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search active loan by game or borrower..."
                      className="pl-9 h-10"
                      value={returnSearch}
                      onChange={e => setReturnSearch(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredLoans.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No active loans to return</p>
                    ) : (
                      filteredLoans.slice(0, 8).map((loan: any) => (
                        <div key={loan.id} className="p-2.5 rounded-lg bg-muted/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{loan.game?.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {loan.guest_name || "Attendee"}
                                {loan.condition_out && <span> · Out: <span className="capitalize">{loan.condition_out}</span></span>}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={conditionInMap[loan.id] || "good"}
                              onValueChange={(v) => setConditionInMap(prev => ({ ...prev, [loan.id]: v }))}
                            >
                              <SelectTrigger className="w-24 h-6 text-[10px]">
                                <SelectValue placeholder="Condition" />
                              </SelectTrigger>
                              <SelectContent>
                                {CONDITIONS.map(c => (
                                  <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-0.5 ml-auto">
                              {[1,2,3,4,5].map(s => (
                                <button
                                  key={s}
                                  onClick={() => setRatingMap(prev => ({ ...prev, [loan.id]: s }))}
                                  className="focus:outline-none"
                                >
                                  <Star className={`h-3 w-3 transition-colors ${s <= (ratingMap[loan.id] || 0) ? "text-secondary fill-secondary" : "text-muted-foreground/30"}`} />
                                </button>
                              ))}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[10px] h-6 px-2"
                              disabled={returnMutation.isPending}
                              onClick={() => returnMutation.mutate(loan.id)}
                            >
                              <RotateCcw className="h-3 w-3 mr-0.5" /> Return
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reservation Queue */}
          {reservations.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4 text-secondary" />
                    Reservations
                    <Badge variant="secondary" className="text-[10px] ml-1">{reservations.length}</Badge>
                  </h3>
                </div>
                <div className="space-y-2">
                  {reservations.map((r: any) => {
                    const isExpired = r.status === "expired" || new Date(r.expires_at) < new Date();
                    return (
                      <div key={r.id} className={`flex items-center justify-between p-2.5 rounded-lg ${isExpired ? "bg-destructive/10 border border-destructive/20" : "bg-secondary/10 border border-secondary/20"}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.game?.title}</p>
                          <p className="text-xs text-muted-foreground">{r.reserved_by}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant={isExpired ? "destructive" : "outline"} className="text-[10px]">
                            <Hourglass className="h-2.5 w-2.5 mr-0.5" />
                            {isExpired ? "Expired" : "Active"}
                          </Badge>
                          <Button size="sm" variant={isExpired ? "destructive" : "default"} className="text-[10px] h-6 px-2">
                            {isExpired ? "Release" : <>Fulfill <ChevronRight className="h-3 w-3" /></>}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Pane: Active Loans Feed */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Active Loans
              </CardTitle>
              <Badge variant="outline" className="animate-pulse border-primary text-primary text-[10px]">
                <Wifi className="h-2.5 w-2.5 mr-0.5" /> Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {activeLoans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active loans yet. Check out a game to get started.</p>
            ) : (
              <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
                {activeLoans.map((loan: any) => {
                  const isOverdue = loan.due_at && new Date(loan.due_at) < new Date();
                  const timeOut = loan.checked_out_at
                    ? getTimeElapsed(loan.checked_out_at)
                    : "";
                  return (
                    <div key={loan.id} className={`flex items-center justify-between p-2.5 rounded-lg hover:bg-muted transition-colors ${isOverdue ? "bg-destructive/5 border border-destructive/20" : "bg-muted/50"}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {loan.game?.image_url
                            ? <img src={loan.game.image_url} alt="" className="w-full h-full object-cover" />
                            : <Gamepad2 className="h-4 w-4 text-primary" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {loan.game?.title || "Unknown"}
                            {loan.copy && <span className="text-muted-foreground text-xs ml-1">#{loan.copy.copy_number || ""}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{loan.guest_name || "Attendee"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-[10px]">
                          <Timer className="h-2.5 w-2.5 mr-0.5" />{timeOut}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 px-2"
                          onClick={() => {
                            setSubView("return");
                            setReturnSearch(loan.game?.title || "");
                          }}
                        >
                          Return
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Helper to compute elapsed time from a timestamp */
function getTimeElapsed(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}
