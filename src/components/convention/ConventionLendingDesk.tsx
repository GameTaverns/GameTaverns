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
  ScanLine, ArrowRight, CheckCircle, Star, Search, Package, MapPin, Gamepad2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  event: any;
  activeLoans: any[];
  libraryGames: any[];
  conventionSettings: any;
}

export function ConventionLendingDesk({ event, activeLoans, libraryGames, conventionSettings }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [guestName, setGuestName] = useState("");
  const [returnSearch, setReturnSearch] = useState("");

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
      // Find the club_id from convention settings or use a default
      const clubId = conventionSettings?.club_id;
      if (!clubId) throw new Error("No club configured for this convention");

      const { error } = await supabase.from("club_loans").insert({
        club_id: clubId,
        library_id: event.library_id,
        game_id: selectedGame.id,
        checked_out_by: user!.id,
        guest_name: guestName.trim(),
        status: "checked_out",
        condition_out: "good",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Checked out "${selectedGame.title}" to ${guestName}`);
      setSelectedGame(null);
      setGuestName("");
      setSearchQuery("");
      queryClient.invalidateQueries({ queryKey: ["convention-active-loans"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Return mutation
  const returnMutation = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await supabase
        .from("club_loans")
        .update({ status: "returned", returned_at: new Date().toISOString() })
        .eq("id", loanId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Game returned successfully");
      queryClient.invalidateQueries({ queryKey: ["convention-active-loans"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Type a game name or scan barcode..."
                className="pl-10 h-12 text-lg"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSelectedGame(null); }}
                autoFocus
              />
            </div>
          </div>
          {filteredGames.length > 0 && !selectedGame && (
            <div className="mt-3 max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2 bg-background">
              {filteredGames.slice(0, 10).map((g: any) => (
                <button
                  key={g.id}
                  className="w-full text-left p-2 rounded hover:bg-muted flex items-center justify-between"
                  onClick={() => { setSelectedGame(g); setSearchQuery(g.title); }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden">
                      {g.image_url ? <img src={g.image_url} alt="" className="w-full h-full object-cover" /> : <Gamepad2 className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <span className="text-sm font-medium">{g.title}</span>
                  </div>
                  <Badge variant={g.available > 0 ? "secondary" : "destructive"} className="text-xs">
                    {g.available > 0 ? `${g.available} avail` : "All out"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Checkout Flow */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <ArrowRight className="h-5 w-5" /> Check Out
            </CardTitle>
            <CardDescription>Assign a game to an attendee</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedGame ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-muted overflow-hidden flex items-center justify-center">
                    {selectedGame.image_url ? <img src={selectedGame.image_url} alt="" className="w-full h-full object-cover" /> : <Gamepad2 className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="font-medium">{selectedGame.title}</p>
                    <p className="text-xs text-muted-foreground">{selectedGame.available} of {selectedGame.copies_owned || 1} available</p>
                  </div>
                </div>
                <Input
                  placeholder="Borrower name..."
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                />
                <Separator />
                <Button
                  className="w-full"
                  disabled={!guestName.trim() || selectedGame.available <= 0 || checkoutMutation.isPending}
                  onClick={() => checkoutMutation.mutate()}
                >
                  {checkoutMutation.isPending ? "Checking out..." : "Confirm Checkout"}
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-lg border-2 border-dashed border-border flex flex-col items-center gap-2 text-muted-foreground">
                <ScanLine className="h-8 w-8" />
                <p className="text-sm">Search for a game above to begin checkout</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Return Flow */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-accent">
              <CheckCircle className="h-5 w-5" /> Return
            </CardTitle>
            <CardDescription>Process a game return</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search active loans..."
                className="pl-9"
                value={returnSearch}
                onChange={e => setReturnSearch(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredLoans.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active loans to return</p>
              ) : (
                filteredLoans.slice(0, 8).map((loan: any) => (
                  <div key={loan.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{loan.game?.title}</p>
                      <p className="text-xs text-muted-foreground">{loan.guest_name || "Attendee"}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      disabled={returnMutation.isPending}
                      onClick={() => returnMutation.mutate(loan.id)}
                    >
                      Return
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Inventory Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {gameAvailability.slice(0, 12).map((item: any) => (
              <div key={item.id} className="p-3 rounded-lg border bg-card">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-sm truncate">{item.title}</p>
                  <Badge variant={item.available === 0 ? "destructive" : "secondary"} className="text-xs shrink-0 ml-1">
                    {item.available === 0 ? "All Out" : `${item.available} avail`}
                  </Badge>
                </div>
                <Progress value={(item.loansOut / (item.copies_owned || 1)) * 100} className="h-1.5 mb-1" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{item.loansOut} out of {item.copies_owned || 1}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
