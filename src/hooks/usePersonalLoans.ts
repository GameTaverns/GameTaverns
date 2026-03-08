import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export interface PersonalLoan {
  id: string;
  library_id: string;
  owner_user_id: string;
  game_id: string;
  borrower_name: string;
  borrower_contact: string | null;
  status: "active" | "returned" | "overdue";
  loaned_at: string;
  due_date: string | null;
  returned_at: string | null;
  condition_out: string | null;
  condition_in: string | null;
  notes: string | null;
  copy_id: string | null;
  created_at: string;
  updated_at: string;
  game?: {
    id: string;
    title: string;
    slug: string | null;
    image_url: string | null;
    copies_owned?: number;
  };
  copy?: {
    id: string;
    copy_number: number;
    copy_label: string | null;
    condition: string | null;
  } | null;
}

export function usePersonalLoans(libraryId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["personal-loans", libraryId],
    queryFn: async () => {
      if (!libraryId) return [];
      const { data, error } = await (supabase as any)
        .from("personal_loans")
        .select(`
          *,
          game:games(id, title, slug, image_url, copies_owned),
          copy:game_copies(id, copy_number, copy_label, condition)
        `)
        .eq("library_id", libraryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PersonalLoan[];
    },
    enabled: !!libraryId && !!user,
  });

  const activeLoans = loans.filter((l) => l.status === "active" || l.status === "overdue");
  const returnedLoans = loans.filter((l) => l.status === "returned");

  const createLoan = useMutation({
    mutationFn: async (input: {
      library_id: string;
      game_id: string;
      borrower_name: string;
      borrower_contact?: string;
      due_date?: string;
      condition_out?: string;
      notes?: string;
      copy_id?: string;
    }) => {
      if (!user) throw new Error("Must be logged in");
      const { data, error } = await (supabase as any)
        .from("personal_loans")
        .insert({
          ...input,
          owner_user_id: user.id,
          borrower_contact: input.borrower_contact || null,
          due_date: input.due_date || null,
          condition_out: input.condition_out || null,
          notes: input.notes || null,
          copy_id: input.copy_id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personal-loans"] });
    },
  });

  const returnLoan = useMutation({
    mutationFn: async (input: {
      loanId: string;
      condition_in?: string;
      notes?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from("personal_loans")
        .update({
          status: "returned",
          returned_at: new Date().toISOString(),
          condition_in: input.condition_in || null,
          notes: input.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.loanId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personal-loans"] });
    },
  });

  const deleteLoan = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await (supabase as any)
        .from("personal_loans")
        .delete()
        .eq("id", loanId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personal-loans"] });
    },
  });

  return {
    loans,
    activeLoans,
    returnedLoans,
    isLoading,
    createLoan,
    returnLoan,
    deleteLoan,
  };
}
