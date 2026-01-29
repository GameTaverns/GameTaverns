import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CalendarEvent {
  event_type: "poll" | "standalone";
  id: string;
  library_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_location: string | null;
  share_token: string | null;
  poll_status: string | null;
  created_at: string;
}

export interface CreateEventInput {
  library_id: string;
  title: string;
  description?: string;
  event_date: string;
  event_location?: string;
}

/**
 * Fetch upcoming events for a library (polls with event dates + standalone events)
 */
export function useUpcomingEvents(libraryId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ["library-events", libraryId, limit],
    queryFn: async () => {
      if (!libraryId) return [];
      
      // Query the combined view
      const { data, error } = await supabase
        .from("library_calendar_events")
        .select("*")
        .eq("library_id", libraryId)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data || []) as CalendarEvent[];
    },
    enabled: !!libraryId,
  });
}

/**
 * Fetch all events for a library (past and future)
 */
export function useAllLibraryEvents(libraryId: string | undefined) {
  return useQuery({
    queryKey: ["library-all-events", libraryId],
    queryFn: async () => {
      if (!libraryId) return [];
      
      const { data, error } = await supabase
        .from("library_calendar_events")
        .select("*")
        .eq("library_id", libraryId)
        .order("event_date", { ascending: true });

      if (error) throw error;
      return (data || []) as CalendarEvent[];
    },
    enabled: !!libraryId,
  });
}

/**
 * Create a standalone event (not tied to a poll)
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      const { data, error } = await supabase
        .from("library_events")
        .insert({
          library_id: input.library_id,
          title: input.title,
          description: input.description || null,
          event_date: input.event_date,
          event_location: input.event_location || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["library-events", variables.library_id] });
      queryClient.invalidateQueries({ queryKey: ["library-all-events", variables.library_id] });
      toast({
        title: "Event created",
        description: "Your event has been added to the calendar.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create event",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Delete a standalone event
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, libraryId }: { eventId: string; libraryId: string }) => {
      const { error } = await supabase
        .from("library_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;
      return { eventId, libraryId };
    },
    onSuccess: ({ libraryId }) => {
      queryClient.invalidateQueries({ queryKey: ["library-events", libraryId] });
      queryClient.invalidateQueries({ queryKey: ["library-all-events", libraryId] });
      toast({
        title: "Event deleted",
        description: "The event has been removed from your calendar.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete event",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
