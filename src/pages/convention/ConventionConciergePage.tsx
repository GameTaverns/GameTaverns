import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { ArrowLeft, Dice5, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConventionConcierge } from "@/components/convention/ConventionConcierge";
import { useAuth } from "@/hooks/useAuth";

/**
 * Public-facing Convention Concierge page.
 * Accessible to any authenticated user — this is the attendee-facing tool.
 * Route: /convention/:eventId/concierge
 */
export default function ConventionConciergePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch the library event
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["convention-event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_events")
        .select("*, library:libraries(id, name, slug, owner_id), convention_event:convention_events(id, club_id, club:clubs(id, name))")
        .eq("id", eventId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Fetch convention settings
  const { data: conventionSettings } = useQuery({
    queryKey: ["convention-settings", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convention_events")
        .select("*")
        .eq("event_id", eventId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const libraryId = event?.library_id;
  const clubId = (event as any)?.convention_event?.club_id;

  // Fetch club library IDs if club-based
  const { data: clubLibraryIds } = useQuery({
    queryKey: ["convention-club-libraries", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_libraries")
        .select("library_id")
        .eq("club_id", clubId!);
      if (error) throw error;
      return data?.map(cl => cl.library_id) || [];
    },
    enabled: !!clubId,
  });

  const lendingLibraryIds = clubLibraryIds?.length ? clubLibraryIds : libraryId ? [libraryId] : [];
  const lendingLibraryKey = lendingLibraryIds.sort().join(",");

  // Fetch games
  const { data: libraryGames = [] } = useQuery({
    queryKey: ["convention-library-games", lendingLibraryKey],
    queryFn: async () => {
      if (lendingLibraryIds.length === 1) {
        const { data, error } = await supabase
          .from("games")
          .select("id, title, slug, image_url, min_players, max_players, play_time_minutes, play_time, copies_owned, weight, library_id, game_type, genre, difficulty, is_unplayed, is_expansion")
          .eq("library_id", lendingLibraryIds[0])
          .eq("ownership_status", "owned")
          .eq("is_expansion", false)
          .order("title");
        if (error) throw error;
        return data || [];
      }
      const { data, error } = await supabase
        .from("games")
        .select("id, title, slug, image_url, min_players, max_players, play_time_minutes, play_time, copies_owned, weight, library_id, game_type, genre, difficulty, is_unplayed, is_expansion")
        .in("library_id", lendingLibraryIds)
        .eq("ownership_status", "owned")
        .eq("is_expansion", false)
        .order("title");
      if (error) throw error;
      return data || [];
    },
    enabled: lendingLibraryIds.length > 0,
  });

  // Fetch active loans
  const { data: activeLoans = [] } = useQuery({
    queryKey: ["convention-active-loans", libraryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_loans")
        .select("*, game:games(id, title, slug, image_url, copies_owned), copy:game_copies(id, copy_number, copy_label, condition)")
        .eq("library_id", libraryId!)
        .eq("status", "checked_out")
        .order("checked_out_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!libraryId,
    refetchInterval: 15000,
  });

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading concierge...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">Convention event not found</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  const clubName = (event as any).convention_event?.club?.name;
  const contextName = clubName || (event as any).library?.name;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <div className="max-w-4xl mx-auto px-4 py-6 w-full flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-7 px-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-display text-primary flex items-center gap-2">
                <Dice5 className="h-6 w-6" />
                Game Concierge
              </h1>
            </div>
            <p className="text-sm text-muted-foreground ml-9">
              {event.title} — {contextName}
              {event.venue_name && ` · ${event.venue_name}`}
              {libraryGames.length > 0 && ` · ${libraryGames.length} games available`}
            </p>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
            <Wifi className="h-3 w-3 mr-1" /> Live
          </Badge>
        </div>

        <ConventionConcierge
          event={event}
          libraryGames={libraryGames}
          activeLoans={activeLoans}
          conventionSettings={conventionSettings}
        />
      </div>
      <Footer />
    </div>
  );
}
