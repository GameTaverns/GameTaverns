import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export type ConventionRole = "owner" | "staff" | "attendee" | "none";

export function useConventionAccess(eventId: string | undefined, event: any) {
  const { user } = useAuth();

  // Check if user is explicitly on the convention_staff table
  const { data: staffRecord, isLoading: staffLoading } = useQuery({
    queryKey: ["convention-staff-check", eventId, user?.id],
    queryFn: async () => {
      // First get the convention_event_id from event_id
      const { data: ce } = await supabase
        .from("convention_events")
        .select("id")
        .eq("event_id", eventId!)
        .maybeSingle();

      if (!ce) return null;

      const { data, error } = await supabase
        .from("convention_staff")
        .select("id, role")
        .eq("convention_event_id", ce.id)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: !!eventId && !!user,
    staleTime: 60000,
  });

  const isOwner = !!event && !!user && (
    event.library?.owner_id === user.id ||
    event.created_by_user_id === user.id
  );

  const isStaff = !!staffRecord;

  const role: ConventionRole = isOwner
    ? "owner"
    : isStaff
      ? "staff"
      : user
        ? "attendee"
        : "none";

  return {
    role,
    isOwner,
    isStaff,
    isStaffOrOwner: isOwner || isStaff,
    isLoading: staffLoading,
    staffRole: staffRecord?.role,
  };
}
