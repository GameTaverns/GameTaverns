import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Calendar, Plus, ArrowRight, Settings } from "lucide-react";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";

export default function ConventionIndex() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  // Fetch all convention events for libraries the user owns
  const { data: conventions = [], isLoading } = useQuery({
    queryKey: ["my-conventions", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get user's libraries
      const { data: libs } = await supabase
        .from("libraries")
        .select("id, name")
        .eq("owner_id", user.id);

      const libIds = (libs || []).map((l: any) => l.id);

      // Get events: owned-library events + events created by user
      const queries = [];
      if (libIds.length) {
        queries.push(
          supabase
            .from("library_events")
            .select("id, title, event_date, end_date, library_id, created_by_user_id")
            .in("library_id", libIds)
            .order("event_date", { ascending: false })
            .limit(100)
        );
      }
      queries.push(
        supabase
          .from("library_events")
          .select("id, title, event_date, end_date, library_id, created_by_user_id")
          .eq("created_by_user_id", user.id)
          .order("event_date", { ascending: false })
          .limit(100)
      );

      const results = await Promise.all(queries);
      const allEvents = results.flatMap(r => r.data || []);
      // Deduplicate by id
      const eventMap = new Map(allEvents.map((e: any) => [e.id, e]));
      const events = Array.from(eventMap.values());

      if (!events.length) return [];

      // Get convention_events entries (includes club_id)
      const { data: convEvents } = await supabase
        .from("convention_events")
        .select("id, event_id, lending_enabled, kiosk_mode_enabled, club_id")
        .in("event_id", events.map((e: any) => e.id));

      const convMap = new Map((convEvents || []).map((c: any) => [c.event_id, c]));

      // Fetch club names for any conventions linked to clubs
      const clubIds = [...new Set((convEvents || []).filter((c: any) => c.club_id).map((c: any) => c.club_id))];
      let clubMap = new Map<string, string>();
      if (clubIds.length) {
        const { data: clubs } = await supabase
          .from("clubs")
          .select("id, name")
          .in("id", clubIds);
        clubMap = new Map((clubs || []).map((c: any) => [c.id, c.name]));
      }

      const libMap = new Map((libs || []).map((l: any) => [l.id, l.name]));

      return events.map((e: any) => {
        const conv = convMap.get(e.id);
        const clubName = conv?.club_id ? clubMap.get(conv.club_id) : null;
        return {
          ...e,
          displayName: clubName || libMap.get(e.library_id) || null,
          conventionSettings: conv || null,
        };
      });
    },
    enabled: !!user,
    staleTime: 30000,
  });

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  const configured = conventions.filter((c: any) => c.conventionSettings);
  const unconfigured = conventions.filter((c: any) => !c.conventionSettings);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-3xl flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t('hub.conventionHub', { defaultValue: 'Convention Hub' })}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage live event operations & game lending
            </p>
          </div>
          <Link to="/events">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Create Event
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : conventions.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="font-semibold text-lg text-foreground mb-1">No events yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create a library event first, then configure it for convention operations.
            </p>
            <Link to="/events">
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" /> Create Your First Event
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {configured.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Active Conventions
                </h2>
                <div className="space-y-3">
                  {configured.map((event: any) => (
                    <Link
                      key={event.id}
                      to={`/convention/${event.id}`}
                      className="block rounded-xl border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: "hsl(150, 70%, 45%, 0.12)" }}
                          >
                            <Calendar className="h-5 w-5" style={{ color: "hsl(150, 70%, 45%)" }} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{event.title}</h3>
                            <p className="text-xs text-muted-foreground">
                              {event.displayName}
                              {event.event_date && ` · ${new Date(event.event_date).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs">Live</Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {unconfigured.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Events Without Convention Setup
                </h2>
                <div className="space-y-3">
                  {unconfigured.map((event: any) => (
                    <Link
                      key={event.id}
                      to={`/convention/${event.id}`}
                      className="block rounded-xl border border-dashed bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: "hsl(var(--muted))" }}
                          >
                            <Settings className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{event.title}</h3>
                            <p className="text-xs text-muted-foreground">
                              {event.libraryName}
                              {event.event_date && ` · ${new Date(event.event_date).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Needs Setup</Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
