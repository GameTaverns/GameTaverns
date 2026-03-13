import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, Gamepad2, Search, Timer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

interface ConventionAttendeeViewProps {
  event: any;
  conventionSettings: any;
}

export function ConventionAttendeeView({ event, conventionSettings }: ConventionAttendeeViewProps) {
  const { user } = useAuth();

  // Fetch the attendee's own active loans
  const { data: myLoans = [] } = useQuery({
    queryKey: ["my-convention-loans", event.library_id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_loans")
        .select("*, game:games(id, title, slug, image_url)")
        .eq("library_id", event.library_id)
        .eq("borrower_user_id", user!.id)
        .eq("status", "checked_out")
        .order("checked_out_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!event.library_id,
    refetchInterval: 30000,
  });

  // Fetch the attendee's own reservations
  const { data: myReservations = [] } = useQuery({
    queryKey: ["my-convention-reservations", conventionSettings?.id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convention_reservations")
        .select("*, game:games(id, title, slug, image_url)")
        .eq("convention_event_id", conventionSettings!.id)
        .eq("reserved_by", user!.id)
        .in("status", ["active"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!conventionSettings?.id,
    refetchInterval: 30000,
  });

  function formatElapsed(checkedOutAt: string) {
    const mins = Math.floor((Date.now() - new Date(checkedOutAt).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  return (
    <div className="space-y-6">
      {/* Concierge CTA */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Search className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">Game Concierge</h3>
                <p className="text-sm text-muted-foreground">
                  Browse available games, get recommendations, and reserve titles
                </p>
              </div>
            </div>
            <Button asChild>
              <Link to={`/convention/${event.id}/concierge`}>
                <Gamepad2 className="h-4 w-4 mr-2" /> Open Concierge
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* My Active Loans */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            My Borrowed Games
            {myLoans.length > 0 && (
              <Badge variant="secondary" className="text-xs">{myLoans.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myLoans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              You don't have any games checked out right now.
            </p>
          ) : (
            <div className="space-y-3">
              {myLoans.map((loan: any) => (
                <div key={loan.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  {loan.game?.image_url && (
                    <img src={loan.game.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{loan.game?.title || "Unknown"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Timer className="h-3 w-3" />
                      <span>{formatElapsed(loan.checked_out_at)} ago</span>
                    </div>
                  </div>
                  {loan.due_at && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      <Clock className="h-3 w-3 mr-1" />
                      Due {new Date(loan.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Reservations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            My Reservations
            {myReservations.length > 0 && (
              <Badge variant="secondary" className="text-xs">{myReservations.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myReservations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active reservations. Use the Concierge to reserve a game!
            </p>
          ) : (
            <div className="space-y-3">
              {myReservations.map((res: any) => (
                <div key={res.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  {res.game?.image_url && (
                    <img src={res.game.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{res.game?.title || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Reserved · Expires {new Date(res.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 text-xs">
                    Pending Pickup
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
