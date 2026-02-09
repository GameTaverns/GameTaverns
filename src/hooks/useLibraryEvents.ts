import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";
import { useDiscordNotify } from "@/hooks/useDiscordNotify";

export interface CalendarEvent {
  event_type: "poll" | "standalone" | "event" | "game_night"; // "event"/"game_night" for backwards compat with self-hosted
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

export interface UpdateEventInput {
  eventId: string;
  libraryId: string;
  updates: {
    title?: string;
    description?: string | null;
    event_date?: string;
    event_location?: string | null;
  };
}

/**
 * Fetch upcoming events for a library (polls with event dates + standalone events)
 */
export function useUpcomingEvents(libraryId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ["library-events", libraryId, limit],
    queryFn: async () => {
      if (!libraryId) return [];
      
      // Get start of today (midnight) for proper date comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Query the combined view
      const { data, error } = await supabase
        .from("library_calendar_events")
        .select("*")
        .eq("library_id", libraryId)
        .gte("event_date", today.toISOString())
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
  const discord = useDiscordNotify();

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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["library-events", variables.library_id] });
      queryClient.invalidateQueries({ queryKey: ["library-all-events", variables.library_id] });
      
      // Send Discord notification and forum post with event ID so thread can be saved
      discord.notifyEventCreated(variables.library_id, {
        id: data.id,
        title: variables.title,
        description: variables.description,
        event_date: variables.event_date,
        event_location: variables.event_location,
      });
      
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
 * Update a standalone event
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, updates }: UpdateEventInput) => {
      const { data, error } = await supabase
        .from("library_events")
        .update({
          title: updates.title,
          description: updates.description,
          event_date: updates.event_date,
          event_location: updates.event_location,
        })
        .eq("id", eventId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["library-events", variables.libraryId] });
      queryClient.invalidateQueries({ queryKey: ["library-all-events", variables.libraryId] });
      toast({
        title: "Event updated",
        description: "Your event has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update event",
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
  const discord = useDiscordNotify();

  return useMutation({
    mutationFn: async ({ eventId, libraryId }: { eventId: string; libraryId: string }) => {
      // First fetch the event to get the discord_thread_id
      const { data: event, error: fetchError } = await supabase
        .from("library_events")
        .select("discord_thread_id")
        .eq("id", eventId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Delete the event
      const { error } = await supabase
        .from("library_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;
      return { eventId, libraryId, discordThreadId: event?.discord_thread_id };
    },
    onSuccess: ({ libraryId, discordThreadId }) => {
      queryClient.invalidateQueries({ queryKey: ["library-events", libraryId] });
      queryClient.invalidateQueries({ queryKey: ["library-all-events", libraryId] });
      
      // Delete the Discord thread if one was created
      if (discordThreadId) {
        discord.deleteEventThread(libraryId, discordThreadId);
      }
      
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
