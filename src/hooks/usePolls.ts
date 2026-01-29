import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDiscordNotify } from "@/hooks/useDiscordNotify";

export interface Poll {
  id: string;
  library_id: string;
  title: string;
  description: string | null;
  poll_type: "quick" | "game_night";
  status: "draft" | "open" | "closed";
  event_date: string | null;
  event_location: string | null;
  voting_ends_at: string | null;
  max_votes_per_user: number;
  show_results_before_close: boolean;
  share_token: string;
  created_at: string;
  updated_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  game_id: string;
  display_order: number;
  game?: {
    id: string;
    title: string;
    image_url: string | null;
  };
}

export interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  voter_identifier: string;
  voter_name: string | null;
  created_at: string;
}

export interface PollResult {
  poll_id: string;
  option_id: string;
  game_id: string;
  game_title: string;
  image_url: string | null;
  vote_count: number;
}

export interface GameNightRSVP {
  id: string;
  poll_id: string;
  guest_identifier: string;
  guest_name: string | null;
  status: "going" | "maybe" | "not_going";
}

// Get polls for a library
export function useLibraryPolls(libraryId: string | null) {
  return useQuery({
    queryKey: ["library-polls", libraryId],
    queryFn: async () => {
      if (!libraryId) return [];

      const { data, error } = await supabase
        .from("game_polls")
        .select("*")
        .eq("library_id", libraryId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Poll[];
    },
    enabled: !!libraryId,
  });
}

// Get a single poll with options
export function usePoll(pollId: string | null) {
  return useQuery({
    queryKey: ["poll", pollId],
    queryFn: async () => {
      if (!pollId) return null;

      const { data: poll, error: pollError } = await supabase
        .from("game_polls")
        .select("*")
        .eq("id", pollId)
        .single();

      if (pollError) throw pollError;

      const { data: options, error: optionsError } = await supabase
        .from("poll_options")
        .select(`
          *,
          game:games(id, title, image_url)
        `)
        .eq("poll_id", pollId)
        .order("display_order");

      if (optionsError) throw optionsError;

      return {
        ...poll,
        options: options as PollOption[],
      } as Poll & { options: PollOption[] };
    },
    enabled: !!pollId,
  });
}

// Get poll by share token (for public voting)
export function usePollByToken(shareToken: string | null) {
  return useQuery({
    queryKey: ["poll-by-token", shareToken],
    queryFn: async () => {
      if (!shareToken) return null;

      const { data: poll, error: pollError } = await supabase
        .from("game_polls")
        .select("*")
        .eq("share_token", shareToken)
        .single();

      if (pollError) throw pollError;

      const { data: options, error: optionsError } = await supabase
        .from("poll_options")
        .select(`
          *,
          game:games(id, title, image_url)
        `)
        .eq("poll_id", poll.id)
        .order("display_order");

      if (optionsError) throw optionsError;

      return {
        ...poll,
        options: options as PollOption[],
      } as Poll & { options: PollOption[] };
    },
    enabled: !!shareToken,
  });
}

// Get poll results
export function usePollResults(pollId: string | null) {
  return useQuery({
    queryKey: ["poll-results", pollId],
    queryFn: async () => {
      if (!pollId) return [];

      // Get options with games
      const { data: options, error: optionsError } = await supabase
        .from("poll_options")
        .select(`
          id,
          poll_id,
          game_id,
          game:games(title, image_url)
        `)
        .eq("poll_id", pollId);

      if (optionsError) throw optionsError;

      // Get vote counts per option
      const results = await Promise.all(
        (options || []).map(async (option) => {
          const { count } = await supabase
            .from("poll_votes")
            .select("*", { count: "exact", head: true })
            .eq("option_id", option.id);

          return {
            poll_id: option.poll_id,
            option_id: option.id,
            game_id: option.game_id,
            game_title: (option.game as any)?.title || "Unknown",
            image_url: (option.game as any)?.image_url || null,
            vote_count: count || 0,
          } as PollResult;
        })
      );

      return results.sort((a, b) => b.vote_count - a.vote_count);
    },
    enabled: !!pollId,
  });
}

// Get RSVPs for a game night
export function useGameNightRSVPs(pollId: string | null) {
  return useQuery({
    queryKey: ["game-night-rsvps", pollId],
    queryFn: async () => {
      if (!pollId) return [];

      const { data, error } = await supabase
        .from("game_night_rsvps")
        .select("*")
        .eq("poll_id", pollId);

      if (error) throw error;
      return data as GameNightRSVP[];
    },
    enabled: !!pollId,
  });
}

// Create a new poll
export function useCreatePoll() {
  const queryClient = useQueryClient();
  const { notifyPollCreated } = useDiscordNotify();

  return useMutation({
    mutationFn: async ({
      libraryId,
      title,
      description,
      pollType,
      eventDate,
      eventLocation,
      votingEndsAt,
      maxVotesPerUser,
      showResultsBeforeClose,
      gameIds,
    }: {
      libraryId: string;
      title: string;
      description?: string;
      pollType: "quick" | "game_night";
      eventDate?: string;
      eventLocation?: string;
      votingEndsAt?: string;
      maxVotesPerUser?: number;
      showResultsBeforeClose?: boolean;
      gameIds: string[];
    }) => {
      // Create poll
      const { data: poll, error: pollError } = await supabase
        .from("game_polls")
        .insert({
          library_id: libraryId,
          title,
          description,
          poll_type: pollType,
          event_date: eventDate,
          event_location: eventLocation,
          voting_ends_at: votingEndsAt,
          max_votes_per_user: maxVotesPerUser || 1,
          show_results_before_close: showResultsBeforeClose || false,
          status: "open",
        })
        .select()
        .single();

      if (pollError) throw pollError;

      // Create poll options
      const options = gameIds.map((gameId, index) => ({
        poll_id: poll.id,
        game_id: gameId,
        display_order: index,
      }));

      const { error: optionsError } = await supabase
        .from("poll_options")
        .insert(options);

      if (optionsError) throw optionsError;

      return { poll: poll as Poll, gameCount: gameIds.length };
    },
    onSuccess: ({ poll, gameCount }) => {
      queryClient.invalidateQueries({ queryKey: ["library-polls", poll.library_id] });
      toast.success("Poll created successfully!");
      
      // Fire Discord notification
      notifyPollCreated(poll.library_id, {
        title: poll.title,
        poll_type: poll.poll_type,
        game_count: gameCount,
        share_token: poll.share_token,
      });
    },
    onError: (error) => {
      toast.error("Failed to create poll: " + error.message);
    },
  });
}

// Vote on a poll
export function useVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pollId,
      optionId,
      voterIdentifier,
      voterName,
    }: {
      pollId: string;
      optionId: string;
      voterIdentifier: string;
      voterName?: string;
    }) => {
      const { data, error } = await supabase
        .from("poll_votes")
        .insert({
          poll_id: pollId,
          option_id: optionId,
          voter_identifier: voterIdentifier,
          voter_name: voterName,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["poll-results", data.poll_id] });
      toast.success("Vote recorded!");
    },
    onError: (error) => {
      if (error.message.includes("unique")) {
        toast.error("You've already voted for this option");
      } else {
        toast.error("Failed to vote: " + error.message);
      }
    },
  });
}

// Remove vote
export function useRemoveVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pollId,
      optionId,
      voterIdentifier,
    }: {
      pollId: string;
      optionId: string;
      voterIdentifier: string;
    }) => {
      const { error } = await supabase
        .from("poll_votes")
        .delete()
        .eq("poll_id", pollId)
        .eq("option_id", optionId)
        .eq("voter_identifier", voterIdentifier);

      if (error) throw error;
      return { pollId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["poll-results", data.pollId] });
      toast.success("Vote removed");
    },
  });
}

// Update RSVP
export function useUpdateRSVP() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pollId,
      guestIdentifier,
      guestName,
      status,
    }: {
      pollId: string;
      guestIdentifier: string;
      guestName?: string;
      status: "going" | "maybe" | "not_going";
    }) => {
      const { data, error } = await supabase
        .from("game_night_rsvps")
        .upsert({
          poll_id: pollId,
          guest_identifier: guestIdentifier,
          guest_name: guestName,
          status,
        }, { onConflict: "poll_id,guest_identifier" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["game-night-rsvps", data.poll_id] });
      toast.success("RSVP updated!");
    },
  });
}

// Close a poll
export function useClosePoll() {
  const queryClient = useQueryClient();
  const { notifyPollClosed } = useDiscordNotify();

  return useMutation({
    mutationFn: async (pollId: string) => {
      const { data, error } = await supabase
        .from("game_polls")
        .update({ status: "closed" })
        .eq("id", pollId)
        .select()
        .single();

      if (error) throw error;
      
      // Fetch results to include winner in notification
      const { data: results } = await supabase
        .from("poll_results")
        .select("*")
        .eq("poll_id", pollId)
        .order("vote_count", { ascending: false })
        .limit(1);
      
      const winner = results?.[0];
      const { count: totalVotes } = await supabase
        .from("poll_votes")
        .select("*", { count: "exact", head: true })
        .eq("poll_id", pollId);

      return { 
        poll: data as Poll, 
        winner_title: winner?.game_title,
        total_votes: totalVotes || 0,
      };
    },
    onSuccess: ({ poll, winner_title, total_votes }) => {
      queryClient.invalidateQueries({ queryKey: ["poll", poll.id] });
      queryClient.invalidateQueries({ queryKey: ["library-polls", poll.library_id] });
      toast.success("Poll closed");
      
      // Fire Discord notification
      notifyPollClosed(poll.library_id, {
        poll_title: poll.title,
        winner_title,
        total_votes,
      });
    },
  });
}

// Delete a poll
export function useDeletePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pollId, libraryId }: { pollId: string; libraryId: string }) => {
      const { error } = await supabase
        .from("game_polls")
        .delete()
        .eq("id", pollId);

      if (error) throw error;
      return { libraryId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["library-polls", data.libraryId] });
      toast.success("Poll deleted");
    },
  });
}
