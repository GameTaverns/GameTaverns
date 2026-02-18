import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "./useAuth";

export interface GameDocument {
  id: string;
  game_id: string | null;
  catalog_id: string | null;
  library_id: string;
  uploaded_by: string;
  document_type: string;
  title: string;
  file_path: string;
  file_size_bytes: number | null;
  language: string;
  catalog_sync_status: string;
  catalog_sync_requested_at: string | null;
  created_at: string;
}

export const DOCUMENT_TYPES = [
  { value: "rulebook", label: "Rulebook" },
  { value: "quick_reference", label: "Quick Reference" },
  { value: "faq", label: "FAQ / Errata" },
  { value: "scenario", label: "Scenario / Campaign" },
  { value: "other", label: "Other" },
];

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

export function useGameDocuments(gameId: string | null | undefined) {
  return useQuery({
    queryKey: ["game-documents", gameId],
    queryFn: async (): Promise<GameDocument[]> => {
      if (!gameId) return [];
      const { data, error } = await (supabase as any)
        .from("game_documents")
        .select("*")
        .eq("game_id", gameId)
        .order("document_type")
        .order("created_at");
      if (error) throw error;
      return (data || []) as GameDocument[];
    },
    enabled: !!gameId,
  });
}

export function useUploadGameDocument() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      file,
      gameId,
      libraryId,
      catalogId,
      title,
      documentType,
      language,
    }: {
      file: File;
      gameId: string;
      libraryId: string;
      catalogId?: string | null;
      title: string;
      documentType: string;
      language: string;
    }) => {
      if (!user) throw new Error("Must be logged in");

      // Upload file to storage
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const filePath = `${user.id}/${gameId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("game-documents")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Create DB record
      const { data, error } = await (supabase as any)
        .from("game_documents")
        .insert({
          game_id: gameId,
          catalog_id: catalogId || null,
          library_id: libraryId,
          uploaded_by: user.id,
          document_type: documentType,
          title,
          file_path: filePath,
          file_size_bytes: file.size,
          language,
        })
        .select()
        .single();

      if (error) {
        // Clean up orphaned upload on DB failure
        await supabase.storage.from("game-documents").remove([filePath]);
        throw error;
      }

      return data as GameDocument;
    },
    onSuccess: (_: unknown, v: { file: File; gameId: string; libraryId: string; catalogId?: string | null; title: string; documentType: string; language: string }) => {
      qc.invalidateQueries({ queryKey: ["game-documents", v.gameId] });
    },
  });
}

export function useDeleteGameDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ doc }: { doc: GameDocument }) => {
      // Delete from storage first
      await supabase.storage.from("game-documents").remove([doc.file_path]);
      // Delete DB record
      const { error } = await (supabase as any)
        .from("game_documents")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: (_: unknown, v: { doc: GameDocument }) => {
      qc.invalidateQueries({ queryKey: ["game-documents", v.doc.game_id] });
    },
  });
}

export function useRequestCatalogSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await (supabase as any)
        .from("game_documents")
        .update({
          catalog_sync_status: "pending",
          catalog_sync_requested_at: new Date().toISOString(),
        })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game-documents"] });
    },
  });
}

export function getDocumentUrl(filePath: string): string {
  const { data } = supabase.storage.from("game-documents").getPublicUrl(filePath);
  return data.publicUrl;
}

export async function getSignedDocumentUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("game-documents")
    .createSignedUrl(filePath, 3600); // 1 hour expiry
  if (error) throw error;
  return data.signedUrl;
}
