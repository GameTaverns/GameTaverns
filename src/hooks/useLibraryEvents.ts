import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";
import { useDiscordNotify } from "@/hooks/useDiscordNotify";

export interface CalendarEvent {
  event_type: "poll" | "standalone" | "event" | "game_night";
  id: string;
  library_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_location: string | null;
  share_token: string | null;
  poll_status: string | null;
  created_at: string;
  // New planning fields from updated view
  event_category?: string;
  end_date?: string | null;
  event_status?: string;
  is_public?: boolean;
}

export interface CreateEventInput {
  library_id?: string;
  created_by_user_id?: string;
  title: string;
  description?: string;
  event_date: string;
  event_location?: string;
  event_type?: string;
  end_date?: string;
  max_attendees?: number;
  is_public?: boolean;
  venue_name?: string;
  venue_address?: string;
  venue_notes?: string;
  entry_fee?: string;
  age_restriction?: string;
  parking_info?: string;
  location_city?: string;
  location_region?: string;
  location_country?: string;
  status?: string;
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
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
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
      const insertData: Record<string, any> = {
        title: input.title,
        description: input.description || null,
        event_date: input.event_date,
        event_location: input.event_location || null,
      };

      // Library event or standalone
      if (input.library_id) {
        insertData.library_id = input.library_id;
      }
      if (input.created_by_user_id) {
        insertData.created_by_user_id = input.created_by_user_id;
      }

      // Add optional planning fields
      if (input.event_type) insertData.event_type = input.event_type;
      if (input.end_date) insertData.end_date = input.end_date;
      if (input.max_attendees) insertData.max_attendees = input.max_attendees;
      if (input.is_public !== undefined) insertData.is_public = input.is_public;
      if (input.venue_name) insertData.venue_name = input.venue_name;
      if (input.venue_address) insertData.venue_address = input.venue_address;
      if (input.venue_notes) insertData.venue_notes = input.venue_notes;
      if (input.entry_fee) insertData.entry_fee = input.entry_fee;
      if (input.age_restriction) insertData.age_restriction = input.age_restriction;
      if (input.parking_info) insertData.parking_info = input.parking_info;
      if (input.location_city) insertData.location_city = input.location_city;
      if (input.location_region) insertData.location_region = input.location_region;
      if (input.location_country) insertData.location_country = input.location_country;
      if (input.status) insertData.status = input.status;

      const { data, error } = await (supabase as any)
        .from("library_events")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      if (variables.library_id) {
        queryClient.invalidateQueries({ queryKey: ["library-events", variables.library_id] });
        queryClient.invalidateQueries({ queryKey: ["library-all-events", variables.library_id] });
      }
      queryClient.invalidateQueries({ queryKey: ["public-event-directory"] });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
      
      // Send Discord notification for library events
      if (variables.library_id) {
        discord.notifyEventCreated(variables.library_id, {
          id: data.id,
          title: variables.title,
          description: variables.description,
          event_date: variables.event_date,
          event_location: variables.event_location,
        });
      }
      
      toast({
        title: "Event created",
        description: variables.library_id 
          ? "Your event has been added to the calendar."
          : "Your community event is now live in the directory.",
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
      queryClient.invalidateQueries({ queryKey: ["public-event-directory"] });
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
      const { data: event, error: fetchError } = await supabase
        .from("library_events")
        .select("discord_thread_id")
        .eq("id", eventId)
        .maybeSingle();

      if (fetchError) throw fetchError;

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
      queryClient.invalidateQueries({ queryKey: ["public-event-directory"] });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
      
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