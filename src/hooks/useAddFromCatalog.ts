import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";

export function useAddFromCatalog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ catalogId, libraryId }: { catalogId: string; libraryId?: string }) => {
      const { data, error } = await supabase.functions.invoke("add-from-catalog", {
        body: { catalog_id: catalogId, library_id: libraryId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; action: string; game: { id: string; title: string }; message: string };
    },
    onSuccess: (data) => {
      toast({
        title: data.action === "already_exists" ? "Already in Library" : "Game Added!",
        description: data.message,
        variant: data.action === "already_exists" ? "default" : undefined,
      });
      if (data.action === "added") {
        queryClient.invalidateQueries({ queryKey: ["games"] });
        queryClient.invalidateQueries({ queryKey: ["library-games"] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add game",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
