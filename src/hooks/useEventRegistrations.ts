import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;

export interface EventRegistration {
  id: string;
  event_id: string;
  attendee_name: string;
  attendee_email: string | null;
  attendee_user_id: string | null;
  status: "registered" | "waitlisted" | "cancelled";
  waitlist_position: number | null;
  registered_at: string;
  cancelled_at: string | null;
  notes: string | null;
  bringing_text: string | null;
  guest_count: number;
}

export function useEventRegistrations(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-registrations", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      // Try raw table first (works for authenticated hosts/admins who can see emails)
      const { data, error } = await db
        .from("event_registrations")
        .select("*")
        .eq("event_id", eventId)
        .order("registered_at", { ascending: true });
      if (!error) return (data || []) as EventRegistration[];

      // Fall back to public view (anon users / non-hosts — no attendee_email)
      const { data: pubData, error: pubError } = await db
        .from("public_event_registrations")
        .select("*")
        .eq("event_id", eventId)
        .order("registered_at", { ascending: true });
      if (pubError) throw pubError;
      return (pubData || []) as EventRegistration[];
    },
    enabled: !!eventId,
  });
}

export function useRegisterForEvent() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      event_id: string;
      attendee_name: string;
      attendee_email?: string;
      attendee_user_id?: string;
      max_attendees?: number | null;
      notes?: string;
      bringing_text?: string;
      guest_count?: number;
    }) => {
      // Check current count to determine registered vs waitlisted
      // Use public view for count (works for both anon and authenticated)
      const { count, error: countError } = await db
        .from("public_event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", input.event_id)
        .eq("status", "registered");
      if (countError) throw countError;

      const currentCount = count || 0;
      const isWaitlisted = input.max_attendees ? currentCount >= input.max_attendees : false;

      // Get waitlist position if needed
      let waitlistPosition: number | null = null;
      if (isWaitlisted) {
        const { count: wlCount } = await db
          .from("event_registrations")
          .select("*", { count: "exact", head: true })
          .eq("event_id", input.event_id)
          .eq("status", "waitlisted");
        waitlistPosition = (wlCount || 0) + 1;
      }

      const { data, error } = await db
        .from("event_registrations")
        .insert({
          event_id: input.event_id,
          attendee_name: input.attendee_name,
          attendee_email: input.attendee_email || null,
          attendee_user_id: input.attendee_user_id || null,
          status: isWaitlisted ? "waitlisted" : "registered",
          waitlist_position: waitlistPosition,
          notes: input.notes || null,
          bringing_text: input.bringing_text || null,
          guest_count: input.guest_count || 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as EventRegistration;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["event-registrations", data.event_id] });
      toast({
        title: data.status === "waitlisted" ? "Added to waitlist" : "Registered!",
        description: data.status === "waitlisted"
          ? `You're #${data.waitlist_position} on the waitlist`
          : "You're registered for this event",
      });
    },
    onError: (e: Error) => toast({ title: "Registration failed", description: e.message, variant: "destructive" }),
  });
}

export function useCancelRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ registrationId, eventId }: { registrationId: string; eventId: string }) => {
      const { error } = await db
        .from("event_registrations")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", registrationId);
      if (error) throw error;
      return { eventId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ["event-registrations", data.eventId] }),
  });
}

export function useRemoveRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ registrationId, eventId }: { registrationId: string; eventId: string }) => {
      const { error } = await db.from("event_registrations").delete().eq("id", registrationId);
      if (error) throw error;
      return { eventId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ["event-registrations", data.eventId] }),
  });
}
