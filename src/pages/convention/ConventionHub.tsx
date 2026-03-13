import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import {
  LayoutDashboard, BookOpen, Dice5, BarChart3, Wifi, ArrowLeft, Settings,
} from "lucide-react";
import { ConventionCommandCenter } from "@/components/convention/ConventionCommandCenter";
import { ConventionLendingDesk } from "@/components/convention/ConventionLendingDesk";
import { ConventionConcierge } from "@/components/convention/ConventionConcierge";
import { ConventionAnalytics } from "@/components/convention/ConventionAnalytics";
import { ConventionSettings } from "@/components/convention/ConventionSettings";
import { useAuth } from "@/hooks/useAuth";

export default function ConventionHub() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("command");
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // Fetch active loans for this event's library
  const libraryId = event?.library_id;
  
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
    refetchInterval: 15000, // Real-time-ish: every 15s
  });

  // Fetch reservations
  const { data: reservations = [] } = useQuery({
    queryKey: ["convention-reservations", conventionSettings?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convention_reservations")
        .select("*, game:games(id, title, slug, image_url)")
        .eq("convention_event_id", conventionSettings!.id)
        .in("status", ["active"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!conventionSettings?.id,
    refetchInterval: 15000,
  });

  // Fetch all library IDs associated with the club (if club-based), otherwise just the event's library
  const clubId = (event as any)?.convention_event?.club_id;
  
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

  // Use club libraries if available, otherwise fall back to event library
  const lendingLibraryIds = clubLibraryIds?.length ? clubLibraryIds : libraryId ? [libraryId] : [];
  const lendingLibraryKey = lendingLibraryIds.sort().join(",");

  // Fetch games available for lending from all relevant libraries
  const { data: libraryGames = [] } = useQuery({
    queryKey: ["convention-library-games", lendingLibraryKey],
    queryFn: async () => {
      if (lendingLibraryIds.length === 1) {
        // Use .eq for single library (more compatible)
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

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading convention...</div>
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

  const isOwner = (event as any).library?.owner_id === user?.id || event?.created_by_user_id === user?.id;
  const clubName = (event as any).convention_event?.club?.name;
  const contextName = clubName || (event as any).library?.name;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="h-7 px-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-display text-primary flex items-center gap-2">
                <LayoutDashboard className="h-6 w-6" />
                Convention Hub
              </h1>
            </div>
            <p className="text-sm text-muted-foreground ml-9">
              {event.title} — {contextName}
              {event.venue_name && ` · ${event.venue_name}`}
              {libraryGames.length > 0 && ` · ${libraryGames.length} games`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              <Wifi className="h-3 w-3 mr-1" /> Live
            </Badge>
            {isOwner && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-3.5 w-3.5" /> Settings
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="command" className="text-xs gap-1">
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Command</span>
            </TabsTrigger>
            <TabsTrigger value="lending" className="text-xs gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lending Desk</span>
            </TabsTrigger>
            <TabsTrigger value="concierge" className="text-xs gap-1">
              <Dice5 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Concierge</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="command">
            <ConventionCommandCenter
              event={event}
              activeLoans={activeLoans}
              reservations={reservations}
              libraryGames={libraryGames}
              conventionSettings={conventionSettings}
              onSwitchTab={setActiveTab}
            />
          </TabsContent>
          <TabsContent value="lending">
            <ConventionLendingDesk
              event={event}
              activeLoans={activeLoans}
              libraryGames={libraryGames}
              conventionSettings={conventionSettings}
            />
          </TabsContent>
          <TabsContent value="concierge">
            <ConventionConcierge
              event={event}
              libraryGames={libraryGames}
              activeLoans={activeLoans}
              conventionSettings={conventionSettings}
            />
          </TabsContent>
          <TabsContent value="analytics">
            <ConventionAnalytics
              event={event}
              activeLoans={activeLoans}
              libraryGames={libraryGames}
            />
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
      {isOwner && (
        <ConventionSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          conventionSettings={conventionSettings}
          event={event}
        />
      )}
    </div>
  );
}
