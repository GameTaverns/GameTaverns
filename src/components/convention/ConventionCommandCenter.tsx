import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen, CalendarClock, Package, AlertTriangle, Clock, Gamepad2,
  Timer, Wifi, Hourglass, ScanLine, Search, ChevronRight,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

function StatCard({ icon: Icon, label, value, trend, color }: {
  icon: any; label: string; value: string | number; trend: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <Icon className={`h-5 w-5 ${color}`} />
          <span className="text-xs text-muted-foreground">{trend}</span>
        </div>
        <p className="text-2xl font-display">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

interface Props {
  event: any;
  activeLoans: any[];
  reservations: any[];
  libraryGames: any[];
  conventionSettings: any;
  onSwitchTab?: (tab: string) => void;
}

export function ConventionCommandCenter({ event, activeLoans, reservations, libraryGames, conventionSettings, onSwitchTab }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const totalCopies = libraryGames.reduce((sum: number, g: any) => sum + (g.copies_owned || 1), 0);
  const checkedOutCount = activeLoans.length;
  const availableCount = totalCopies - checkedOutCount;
  const overdueLoans = activeLoans.filter((l: any) => {
    if (!l.due_at) return false;
    return new Date(l.due_at) < new Date();
  });
  const activeReservations = reservations.filter((r: any) => r.status === "active");
  const expiringSoon = activeReservations.filter((r: any) => {
    const exp = new Date(r.expires_at);
    const now = new Date();
    return (exp.getTime() - now.getTime()) < 10 * 60 * 1000;
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

  // Fulfill reservation → instant checkout
  const fulfillReservation = useMutation({
    mutationFn: async (reservation: any) => {
      const clubId = conventionSettings?.club_id;
      if (!clubId) throw new Error("No club configured");

      const { error: loanError } = await supabase.from("club_loans").insert({
        club_id: clubId,
        library_id: event.library_id,
        game_id: reservation.game_id,
        checked_out_by: user!.id,
        borrower_user_id: reservation.reserved_by,
        guest_name: "Reservation Pickup",
        status: "checked_out",
        condition_out: "good",
        notes: `Fulfilled from reservation`,
      });
      if (loanError) throw loanError;

      const { error: resError } = await supabase
        .from("convention_reservations")
        .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
        .eq("id", reservation.id);
      if (resError) throw resError;
    },
    onSuccess: () => {
      toast.success("Reservation fulfilled — game checked out!");
      queryClient.invalidateQueries({ queryKey: ["convention-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["convention-reservations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Release expired reservation
  const releaseReservation = useMutation({
    mutationFn: async (resId: string) => {
      const { error } = await supabase
        .from("convention_reservations")
        .update({ status: "cancelled" })
        .eq("id", resId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reservation released");
      queryClient.invalidateQueries({ queryKey: ["convention-reservations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Active Loans" value={checkedOutCount} trend={`of ${totalCopies} copies`} color="text-primary" />
        <StatCard icon={CalendarClock} label="Reservations" value={activeReservations.length} trend={expiringSoon.length > 0 ? `${expiringSoon.length} expiring soon` : "None expiring"} color="text-secondary" />
        <StatCard icon={Package} label="Available" value={`${availableCount} / ${totalCopies}`} trend={`${libraryGames.length} unique games`} color="text-accent" />
        <StatCard icon={AlertTriangle} label="Overdue" value={overdueLoans.length} trend={overdueLoans.length > 0 ? "Needs attention" : "All clear"} color={overdueLoans.length > 0 ? "text-destructive" : "text-muted-foreground"} />
      </div>

      {/* Overdue Alert */}
      {overdueLoans.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm animate-pulse">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-medium">{overdueLoans.length} overdue loan{overdueLoans.length > 1 ? "s" : ""} need attention!</span>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Active Loans Feed */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Active Loans
              </CardTitle>
              <Badge variant="outline" className="animate-pulse border-primary text-primary">
                <Wifi className="h-3 w-3 mr-1" /> Realtime
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeLoans.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No active loans yet. Start checking out games!</p>
            ) : (
              activeLoans.slice(0, 10).map((loan: any) => {
                const checkedOutAt = new Date(loan.checked_out_at);
                const elapsed = Math.round((Date.now() - checkedOutAt.getTime()) / 60000);
                const elapsedStr = elapsed >= 60 ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}m` : `${elapsed}m`;
                const isOverdue = loan.due_at && new Date(loan.due_at) < new Date();
                
                return (
                  <div key={loan.id} className={`flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors ${isOverdue ? "bg-destructive/5 border border-destructive/20" : "bg-muted/50"}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center overflow-hidden">
                        {loan.game?.image_url ? (
                          <img src={loan.game.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Gamepad2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {loan.game?.title || "Unknown Game"}
                          {loan.copy && <span className="text-muted-foreground text-xs ml-1">#{loan.copy.copy_number}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {loan.guest_name || "Attendee"}
                          {loan.due_at && (
                            <span className={isOverdue ? "text-destructive font-medium" : ""}>
                              {" "}· Due {new Date(loan.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-xs">
                        <Timer className="h-3 w-3 mr-1" />{elapsedStr}
                      </Badge>
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
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Reservations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-secondary" />
                Pending Reservations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeReservations.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">No pending reservations</p>
              ) : (
                activeReservations.slice(0, 5).map((r: any) => {
                  const expiresAt = new Date(r.expires_at);
                  const now = new Date();
                  const minsLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 60000));
                  const isExpired = minsLeft <= 0;

                  return (
                    <div key={r.id} className={`flex items-center justify-between p-2 rounded ${isExpired ? "bg-destructive/10" : "bg-secondary/10"}`}>
                      <div>
                        <p className="text-sm font-medium">{r.game?.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isExpired ? "destructive" : "outline"} className="text-xs">
                          <Hourglass className="h-3 w-3 mr-1" />{isExpired ? "Expired" : `${minsLeft}m`}
                        </Badge>
                        {isExpired ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs h-6"
                            disabled={releaseReservation.isPending}
                            onClick={() => releaseReservation.mutate(r.id)}
                          >
                            Release
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs h-6"
                            disabled={fulfillReservation.isPending}
                            onClick={() => fulfillReservation.mutate(r)}
                          >
                            Fulfill <ChevronRight className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-16 flex-col gap-1 text-xs" onClick={() => onSwitchTab?.("lending")}>
                <ScanLine className="h-5 w-5" /> Check Out
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1 text-xs" onClick={() => onSwitchTab?.("lending")}>
                <Search className="h-5 w-5" /> Find Game
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1 text-xs" onClick={() => onSwitchTab?.("lending")}>
                <AlertTriangle className="h-5 w-5" /> Returns
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1 text-xs" onClick={() => onSwitchTab?.("analytics")}>
                <Package className="h-5 w-5" /> Analytics
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
