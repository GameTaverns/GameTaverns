import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/backend/client";

interface ConventionHubCardProps {
  user: { id: string } | null;
}

export function ConventionHubCard({ user }: ConventionHubCardProps) {
  const { t } = useTranslation();

  // Find the user's first convention event via their libraries
  const { data: conventionEvent } = useQuery({
    queryKey: ["my-convention-event", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get user's libraries
      const { data: libs } = await supabase
        .from("libraries")
        .select("id")
        .eq("owner_id", user.id);

      if (!libs?.length) return null;

      const libIds = libs.map((l: any) => l.id);

      // Find library_events that have convention_events
      const { data: events } = await supabase
        .from("library_events")
        .select("id, title, library_id")
        .in("library_id", libIds)
        .order("event_date", { ascending: false })
        .limit(50);

      if (!events?.length) return null;

      // Check which ones have convention_events entries
      const { data: convEvents } = await supabase
        .from("convention_events")
        .select("id, event_id")
        .in("event_id", events.map((e: any) => e.id))
        .limit(1);

      if (convEvents?.length) {
        const matched = events.find((e: any) => e.id === convEvents[0].event_id);
        return { eventId: convEvents[0].event_id, title: matched?.title };
      }

      // No convention event yet — return first library event as fallback
      return { eventId: events[0].id, title: events[0].title, needsSetup: true };
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const linkTo = conventionEvent?.eventId
    ? `/convention/${conventionEvent.eventId}`
    : "/convention";

  return (
    <Link
      to={linkTo}
      className="block rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "hsl(150, 70%, 45%, 0.12)" }}
        >
          <Calendar className="h-5 w-5" style={{ color: "hsl(150, 70%, 45%)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-base">
            {t('hub.conventionHub', { defaultValue: 'Convention Hub' })}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live event operations & game lending
          </p>
          <div className="mt-3 space-y-1">
            <p className="text-xs text-muted-foreground ink-dot">Staff lending desk & checkout</p>
            <p className="text-xs text-muted-foreground ink-dot">Attendee game concierge</p>
            <p className="text-xs text-muted-foreground ink-dot">Real-time analytics</p>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Badge variant="default" className="text-xs">Live</Badge>
            {conventionEvent?.needsSetup && (
              <Badge variant="outline" className="text-xs">Needs Setup</Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
