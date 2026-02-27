import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";

// These tables are self-hosted only and not in the auto-generated Supabase types.
// Cast to any for .from() calls on these tables.
const db = supabase as any;

// ── Types ──────────────────────────────────────────────────────────────────

export interface EventGame {
  id: string;
  event_id: string;
  game_id: string | null;
  catalog_game_id: string | null;
  title: string;
  image_url: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  min_players: number | null;
  max_players: number | null;
  table_label: string | null;
  notes: string | null;
  display_order: number;
  created_at: string;
}

export interface EventSupply {
  id: string;
  event_id: string;
  item_name: string;
  quantity: number;
  category: string;
  claimed_by: string | null;
  claimed_by_user_id: string | null;
  is_fulfilled: boolean;
  created_at: string;
}

export interface EventTable {
  id: string;
  event_id: string;
  table_label: string;
  game_id: string | null;
  game_title: string | null;
  capacity: number;
  notes: string | null;
  display_order: number;
  created_at: string;
}

export interface EventTableSeat {
  id: string;
  table_id: string;
  player_name: string;
  player_user_id: string | null;
  created_at: string;
}

export interface EventAttendeePref {
  id: string;
  event_id: string;
  attendee_identifier: string;
  attendee_name: string | null;
  attendee_user_id: string | null;
  wants_to_play: string[];
  can_bring: string[];
  dietary_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventDetail {
  id: string;
  library_id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  event_location: string | null;
  event_type: string;
  max_attendees: number | null;
  is_public: boolean;
  venue_name: string | null;
  venue_address: string | null;
  venue_notes: string | null;
  entry_fee: string | null;
  age_restriction: string | null;
  parking_info: string | null;
  status: string;
  discord_thread_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Event Detail ───────────────────────────────────────────────────────────

export function useEventDetail(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-detail", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await db
        .from("library_events")
        .select("*")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data as EventDetail;
    },
    enabled: !!eventId,
  });
}

export function useUpdateEventDetail() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, updates }: { eventId: string; updates: Partial<EventDetail> }) => {
      const { data, error } = await db
        .from("library_events")
        .update(updates)
        .eq("id", eventId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["event-detail", data.id] });
      qc.invalidateQueries({ queryKey: ["library-events"] });
      qc.invalidateQueries({ queryKey: ["library-all-events"] });
      toast({ title: "Event updated" });
    },
    onError: (e: Error) => toast({ title: "Failed to update event", description: e.message, variant: "destructive" }),
  });
}

// ── Game Lineup ────────────────────────────────────────────────────────────

export function useEventGames(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-games", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await db
        .from("event_games")
        .select("*")
        .eq("event_id", eventId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as EventGame[];
    },
    enabled: !!eventId,
  });
}

export function useAddEventGame() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Omit<EventGame, "id" | "created_at">) => {
      const { data, error } = await db
        .from("event_games")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["event-games", data.event_id] });
      toast({ title: "Game added to lineup" });
    },
    onError: (e: Error) => toast({ title: "Failed to add game", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateEventGame() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ gameId, eventId, updates }: { gameId: string; eventId: string; updates: Partial<EventGame> }) => {
      const { data, error } = await db
        .from("event_games")
        .update(updates)
        .eq("id", gameId)
        .select()
        .single();
      if (error) throw error;
      return { ...data, event_id: eventId };
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["event-games", data.event_id] });
      toast({ title: "Game updated" });
    },
    onError: (e: Error) => toast({ title: "Failed to update game", description: e.message, variant: "destructive" }),
  });
}

export function useRemoveEventGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gameId, eventId }: { gameId: string; eventId: string }) => {
      const { error } = await db.from("event_games").delete().eq("id", gameId);
      if (error) throw error;
      return { eventId };
    },
    onSuccess: (data: any) => qc.invalidateQueries({ queryKey: ["event-games", data.eventId] }),
  });
}

// ── Supplies ───────────────────────────────────────────────────────────────

export function useEventSupplies(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-supplies", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await db
        .from("event_supplies")
        .select("*")
        .eq("event_id", eventId)
        .order("category", { ascending: true });
      if (error) throw error;
      return (data || []) as EventSupply[];
    },
    enabled: !!eventId,
  });
}

export function useAddEventSupply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<EventSupply, "id" | "created_at">) => {
      const { data, error } = await db
        .from("event_supplies")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => qc.invalidateQueries({ queryKey: ["event-supplies", data.event_id] }),
  });
}

export function useClaimSupply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ supplyId, eventId, claimedBy, userId }: { supplyId: string; eventId: string; claimedBy: string; userId?: string }) => {
      const { error } = await db
        .from("event_supplies")
        .update({ claimed_by: claimedBy, claimed_by_user_id: userId || null, is_fulfilled: true })
        .eq("id", supplyId);
      if (error) throw error;
      return { eventId };
    },
    onSuccess: (data: any) => qc.invalidateQueries({ queryKey: ["event-supplies", data.eventId] }),
  });
}

export function useRemoveEventSupply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ supplyId, eventId }: { supplyId: string; eventId: string }) => {
      const { error } = await db.from("event_supplies").delete().eq("id", supplyId);
      if (error) throw error;
      return { eventId };
    },
    onSuccess: (data: any) => qc.invalidateQueries({ queryKey: ["event-supplies", data.eventId] }),
  });
}

export function useUpdateEventSupply() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ supplyId, eventId, updates }: { supplyId: string; eventId: string; updates: Partial<EventSupply> }) => {
      const { data, error } = await db
        .from("event_supplies")
        .update(updates)
        .eq("id", supplyId)
        .select()
        .single();
      if (error) throw error;
      return { ...data, event_id: eventId };
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["event-supplies", data.event_id] });
      toast({ title: "Supply updated" });
    },
    onError: (e: Error) => toast({ title: "Failed to update supply", description: e.message, variant: "destructive" }),
  });
}

// ── Tables / Groups ────────────────────────────────────────────────────────

export function useEventTables(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-tables", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await db
        .from("event_tables")
        .select("*")
        .eq("event_id", eventId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as EventTable[];
    },
    enabled: !!eventId,
  });
}

export function useAddEventTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<EventTable, "id" | "created_at">) => {
      const { data, error } = await db
        .from("event_tables")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => qc.invalidateQueries({ queryKey: ["event-tables", data.event_id] }),
  });
}

export function useRemoveEventTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, eventId }: { tableId: string; eventId: string }) => {
      const { error } = await db.from("event_tables").delete().eq("id", tableId);
      if (error) throw error;
      return { eventId };
    },
    onSuccess: (data: any) => qc.invalidateQueries({ queryKey: ["event-tables", data.eventId] }),
  });
}

export function useUpdateEventTable() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ tableId, eventId, updates }: { tableId: string; eventId: string; updates: Partial<EventTable> }) => {
      const { data, error } = await db
        .from("event_tables")
        .update(updates)
        .eq("id", tableId)
        .select()
        .single();
      if (error) throw error;
      return { ...data, event_id: eventId };
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["event-tables", data.event_id] });
      toast({ title: "Table updated" });
    },
    onError: (e: Error) => toast({ title: "Failed to update table", description: e.message, variant: "destructive" }),
  });
}

export function useTableSeats(tableId: string | undefined) {
  return useQuery({
    queryKey: ["table-seats", tableId],
    queryFn: async () => {
      if (!tableId) return [];
      const { data, error } = await db
        .from("event_table_seats")
        .select("*")
        .eq("table_id", tableId);
      if (error) throw error;
      return (data || []) as EventTableSeat[];
    },
    enabled: !!tableId,
  });
}

export function useAddTableSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { table_id: string; player_name: string; player_user_id?: string }) => {
      const { data, error } = await db
        .from("event_table_seats")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => qc.invalidateQueries({ queryKey: ["table-seats", data.table_id] }),
  });
}

export function useRemoveTableSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ seatId, tableId }: { seatId: string; tableId: string }) => {
      const { error } = await db.from("event_table_seats").delete().eq("id", seatId);
      if (error) throw error;
      return { tableId };
    },
    onSuccess: (data: any) => qc.invalidateQueries({ queryKey: ["table-seats", data.tableId] }),
  });
}

// ── Attendee Preferences ───────────────────────────────────────────────────

export function useEventAttendeePrefs(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-attendee-prefs", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await db
        .from("event_attendee_prefs")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data || []) as EventAttendeePref[];
    },
    enabled: !!eventId,
  });
}

export function useSubmitAttendeePref() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      event_id: string;
      attendee_identifier: string;
      attendee_name?: string;
      attendee_user_id?: string;
      wants_to_play?: string[];
      can_bring?: string[];
      dietary_notes?: string;
      notes?: string;
    }) => {
      const { data, error } = await db
        .from("event_attendee_prefs")
        .upsert({
          event_id: input.event_id,
          attendee_identifier: input.attendee_identifier,
          attendee_name: input.attendee_name || null,
          attendee_user_id: input.attendee_user_id || null,
          wants_to_play: JSON.stringify(input.wants_to_play || []),
          can_bring: JSON.stringify(input.can_bring || []),
          dietary_notes: input.dietary_notes || null,
          notes: input.notes || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "event_id,attendee_identifier" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["event-attendee-prefs", data.event_id] });
      toast({ title: "Preferences saved" });
    },
    onError: (e: Error) => toast({ title: "Failed to save preferences", description: e.message, variant: "destructive" }),
  });
}
