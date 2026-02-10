import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type LoanStatus = 'requested' | 'approved' | 'active' | 'returned' | 'declined' | 'cancelled';

export interface GameLoan {
  id: string;
  game_id: string;
  library_id: string;
  borrower_user_id: string;
  lender_user_id: string;
  status: LoanStatus;
  requested_at: string;
  approved_at: string | null;
  borrowed_at: string | null;
  due_date: string | null;
  returned_at: string | null;
  borrower_notes: string | null;
  lender_notes: string | null;
  copy_id: string | null;
  condition_out: string | null;
  condition_in: string | null;
  damage_reported: boolean;
  created_at: string;
  // Joined data
  game?: {
    id: string;
    title: string;
    slug: string | null;
    image_url: string | null;
    copies_owned?: number;
  };
  library?: {
    id: string;
    name: string;
    slug: string;
  };
  borrower_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  copy?: {
    id: string;
    copy_number: number;
    copy_label: string | null;
    condition?: string | null;
  } | null;
}

export interface BorrowerRating {
  id: string;
  loan_id: string;
  rated_user_id: string;
  rated_by_user_id: string;
  rating: number;
  review: string | null;
  created_at: string;
}

export interface BorrowerReputation {
  user_id: string;
  total_ratings: number;
  average_rating: number;
  positive_ratings: number;
}

export interface WaitlistEntry {
  id: string;
  game_id: string;
  library_id: string;
  user_id: string;
  status: string;
  notified_at: string | null;
  created_at: string;
}

export interface LendingRules {
  max_loans_per_borrower: number | null;
  default_loan_duration_days: number | null;
  min_borrower_rating: number | null;
}

export function useLending(libraryId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch loans where user is borrower
  const { data: myBorrowedLoans = [], isLoading: borrowedLoading } = useQuery({
    queryKey: ["loans", "borrowed", user?.id, libraryId],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from("game_loans")
        .select(`
          *,
          game:games(id, title, slug, image_url),
          library:libraries(id, name, slug)
        `)
        .eq("borrower_user_id", user.id)
        .order("created_at", { ascending: false });

      if (libraryId) {
        query = query.eq("library_id", libraryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as GameLoan[];
    },
    enabled: !!user,
  });

  // Fetch loans where user is lender (library owner)
  const { data: myLentLoans = [], isLoading: lentLoading } = useQuery({
    queryKey: ["loans", "lent", user?.id, libraryId],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from("game_loans")
        .select(`
          *,
          game:games(id, title, slug, image_url, copies_owned),
          library:libraries(id, name, slug),
          copy:game_copies(id, copy_number, copy_label, condition)
        `)
        .eq("lender_user_id", user.id)
        .order("created_at", { ascending: false });

      if (libraryId) {
        query = query.eq("library_id", libraryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as GameLoan[];
    },
    enabled: !!user,
  });

  // Fetch lending rules for a library
  const useLendingRules = (libId: string | undefined) => {
    return useQuery({
      queryKey: ["lending-rules", libId],
      queryFn: async () => {
        if (!libId) return null;
        const { data, error } = await supabase
          .from("library_settings")
          .select("max_loans_per_borrower, default_loan_duration_days, min_borrower_rating")
          .eq("library_id", libId)
          .maybeSingle();
        if (error) throw error;
        return data as LendingRules | null;
      },
      enabled: !!libId,
    });
  };

  // Fetch available copies for a game
  const useGameCopies = (gameId: string | undefined) => {
    return useQuery({
      queryKey: ["game-copies", gameId],
      queryFn: async () => {
        if (!gameId) return [];
        const { data, error } = await supabase
          .from("game_copies")
          .select("*")
          .eq("game_id", gameId)
          .order("copy_number", { ascending: true });
        if (error) throw error;
        return data;
      },
      enabled: !!gameId,
    });
  };

  // Fetch loan history for a specific game
  const useGameLoanHistory = (gameId: string | undefined) => {
    return useQuery({
      queryKey: ["game-loan-history", gameId],
      queryFn: async () => {
        if (!gameId) return [];
        const { data, error } = await supabase
          .from("game_loans")
          .select(`
            *,
            copy:game_copies(id, copy_number, copy_label)
          `)
          .eq("game_id", gameId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data as GameLoan[];
      },
      enabled: !!gameId,
    });
  };

  // Fetch waitlist for a game
  const useGameWaitlist = (gameId: string | undefined) => {
    return useQuery({
      queryKey: ["waitlist", gameId],
      queryFn: async () => {
        if (!gameId) return [];
        const { data, error } = await supabase
          .from("loan_waitlist")
          .select("*")
          .eq("game_id", gameId)
          .eq("status", "waiting")
          .order("created_at", { ascending: true });
        if (error) throw error;
        return data as WaitlistEntry[];
      },
      enabled: !!gameId,
    });
  };

  // Request to borrow a game
  const requestLoan = useMutation({
    mutationFn: async ({
      gameId,
      libraryId,
      lenderUserId,
      notes,
      gameTitle,
      gameImageUrl,
      borrowerName,
    }: {
      gameId: string;
      libraryId: string;
      lenderUserId: string;
      notes?: string;
      gameTitle?: string;
      gameImageUrl?: string;
      borrowerName?: string;
    }) => {
      if (!user) throw new Error("Must be logged in to request a loan");

      const { data, error } = await supabase
        .from("game_loans")
        .insert({
          game_id: gameId,
          library_id: libraryId,
          borrower_user_id: user.id,
          lender_user_id: lenderUserId,
          borrower_notes: notes || null,
          status: "requested",
        })
        .select()
        .single();

      if (error) throw error;

      // Send Discord notification to lender (fire-and-forget)
      try {
        await supabase.functions.invoke("discord-notify", {
          body: {
            library_id: libraryId,
            lender_user_id: lenderUserId,
            event_type: "loan_requested",
            data: {
              game_title: gameTitle || "a game",
              image_url: gameImageUrl,
              borrower_name: borrowerName || "Someone",
              notes: notes,
            },
          },
        });
      } catch (notifyError) {
        console.error("Discord notification failed:", notifyError);
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Loan request sent!");
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (error) => {
      toast.error("Failed to request loan: " + error.message);
    },
  });

  // Approve a loan request (lender action) - now with copy assignment & condition
  const approveLoan = useMutation({
    mutationFn: async ({
      loanId,
      dueDate,
      notes,
      copyId,
      conditionOut,
    }: {
      loanId: string;
      dueDate?: string;
      notes?: string;
      copyId?: string;
      conditionOut?: string;
    }) => {
      const { data, error } = await supabase
        .from("game_loans")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          due_date: dueDate || null,
          lender_notes: notes || null,
          copy_id: copyId || null,
          condition_out: conditionOut || null,
        })
        .eq("id", loanId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Loan approved!");
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (error) => {
      toast.error("Failed to approve loan: " + error.message);
    },
  });

  // Decline a loan request
  const declineLoan = useMutation({
    mutationFn: async ({ loanId, notes }: { loanId: string; notes?: string }) => {
      const { data, error } = await supabase
        .from("game_loans")
        .update({
          status: "declined",
          lender_notes: notes || null,
        })
        .eq("id", loanId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Loan request declined");
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (error) => {
      toast.error("Failed to decline loan: " + error.message);
    },
  });

  // Mark as picked up (active)
  const markPickedUp = useMutation({
    mutationFn: async ({ loanId }: { loanId: string }) => {
      const { data, error } = await supabase
        .from("game_loans")
        .update({
          status: "active",
          borrowed_at: new Date().toISOString(),
        })
        .eq("id", loanId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Game marked as picked up!");
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (error) => {
      toast.error("Failed to update loan: " + error.message);
    },
  });

  // Mark as returned - now with condition check-in
  const markReturned = useMutation({
    mutationFn: async ({ 
      loanId, 
      conditionIn, 
      damageReported 
    }: { 
      loanId: string; 
      conditionIn?: string;
      damageReported?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("game_loans")
        .update({
          status: "returned",
          returned_at: new Date().toISOString(),
          condition_in: conditionIn || null,
          damage_reported: damageReported || false,
        })
        .eq("id", loanId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Game marked as returned!");
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
    },
    onError: (error) => {
      toast.error("Failed to update loan: " + error.message);
    },
  });

  // Cancel a loan request (borrower action)
  const cancelLoan = useMutation({
    mutationFn: async ({ loanId }: { loanId: string }) => {
      const { data, error } = await supabase
        .from("game_loans")
        .update({ status: "cancelled" })
        .eq("id", loanId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Loan request cancelled");
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (error) => {
      toast.error("Failed to cancel loan: " + error.message);
    },
  });

  // Rate a borrower after return
  const rateBorrower = useMutation({
    mutationFn: async ({
      loanId,
      borrowerUserId,
      rating,
      review,
    }: {
      loanId: string;
      borrowerUserId: string;
      rating: number;
      review?: string;
    }) => {
      if (!user) throw new Error("Must be logged in to rate");

      const { data, error } = await supabase
        .from("borrower_ratings")
        .insert({
          loan_id: loanId,
          rated_user_id: borrowerUserId,
          rated_by_user_id: user.id,
          rating,
          review: review || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Rating submitted!");
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["borrower-reputation"] });
    },
    onError: (error) => {
      toast.error("Failed to submit rating: " + error.message);
    },
  });

  // Join waitlist
  const joinWaitlist = useMutation({
    mutationFn: async ({ gameId, libraryId }: { gameId: string; libraryId: string }) => {
      if (!user) throw new Error("Must be logged in");
      const { data, error } = await supabase
        .from("loan_waitlist")
        .insert({
          game_id: gameId,
          library_id: libraryId,
          user_id: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Added to waitlist! You'll be notified when available.");
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
    },
    onError: (error) => {
      toast.error("Failed to join waitlist: " + error.message);
    },
  });

  // Leave waitlist
  const leaveWaitlist = useMutation({
    mutationFn: async ({ waitlistId }: { waitlistId: string }) => {
      const { error } = await supabase
        .from("loan_waitlist")
        .delete()
        .eq("id", waitlistId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from waitlist");
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
    },
    onError: (error) => {
      toast.error("Failed to leave waitlist: " + error.message);
    },
  });

  // Bulk approve loans
  const bulkApproveLoan = useMutation({
    mutationFn: async ({ loanIds, dueDate }: { loanIds: string[]; dueDate?: string }) => {
      const { data, error } = await supabase
        .from("game_loans")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          due_date: dueDate || null,
        })
        .in("id", loanIds)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.length} loans approved!`);
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (error) => {
      toast.error("Bulk approve failed: " + error.message);
    },
  });

  // Bulk mark returned
  const bulkMarkReturned = useMutation({
    mutationFn: async ({ loanIds }: { loanIds: string[] }) => {
      const { data, error } = await supabase
        .from("game_loans")
        .update({
          status: "returned",
          returned_at: new Date().toISOString(),
        })
        .in("id", loanIds)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.length} loans marked as returned!`);
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (error) => {
      toast.error("Bulk return failed: " + error.message);
    },
  });

  // Get borrower reputation
  const useBorrowerReputation = (userId: string | undefined) => {
    return useQuery({
      queryKey: ["borrower-reputation", userId],
      queryFn: async () => {
        if (!userId || userId.trim() === "") return null;

        const { data, error } = await supabase
          .from("borrower_reputation")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;
        return data as BorrowerReputation | null;
      },
      enabled: !!userId && userId.trim() !== "",
    });
  };

  // Check active loan count for a borrower in a library
  const checkBorrowerLoanCount = async (borrowerUserId: string, libId: string): Promise<number> => {
    const { data, error } = await supabase
      .from("game_loans")
      .select("id")
      .eq("borrower_user_id", borrowerUserId)
      .eq("library_id", libId)
      .in("status", ["requested", "approved", "active"]);
    if (error) return 0;
    return data.length;
  };

  // Check if game is available for loan
  const checkGameAvailability = async (gameId: string): Promise<{ available: boolean; copiesOwned: number; activeLoans: number; copiesAvailable: number }> => {
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("copies_owned")
      .eq("id", gameId)
      .maybeSingle();

    const copiesOwned = gameData?.copies_owned ?? 1;

    const { data, error } = await supabase
      .from("game_loans")
      .select("id")
      .eq("game_id", gameId)
      .in("status", ["requested", "approved", "active"]);

    if (error || gameError) {
      console.error("Error checking game availability:", error || gameError);
      return { available: true, copiesOwned, activeLoans: 0, copiesAvailable: copiesOwned };
    }

    const activeLoans = data.length;
    const copiesAvailable = Math.max(0, copiesOwned - activeLoans);
    return { available: copiesAvailable > 0, copiesOwned, activeLoans, copiesAvailable };
  };

  return {
    myBorrowedLoans,
    myLentLoans,
    isLoading: borrowedLoading || lentLoading,
    requestLoan,
    approveLoan,
    declineLoan,
    markPickedUp,
    markReturned,
    cancelLoan,
    rateBorrower,
    joinWaitlist,
    leaveWaitlist,
    bulkApproveLoan,
    bulkMarkReturned,
    useBorrowerReputation,
    useLendingRules,
    useGameCopies,
    useGameLoanHistory,
    useGameWaitlist,
    checkBorrowerLoanCount,
    checkGameAvailability,
  };
}
