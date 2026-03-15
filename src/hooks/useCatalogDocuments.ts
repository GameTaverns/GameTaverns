import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "./useAuth";
import { validateDocumentFile } from "@/lib/fileValidation";

export interface CatalogDocument {
  id: string;
  catalog_id: string;
  uploaded_by: string;
  document_type: string;
  title: string;
  file_path: string;
  file_size_bytes: number | null;
  language: string;
  status: string;
  created_at: string;
}

export function useCatalogDocuments(catalogId: string | null | undefined) {
  return useQuery({
    queryKey: ["catalog-documents", catalogId],
    queryFn: async (): Promise<CatalogDocument[]> => {
      if (!catalogId) return [];
      const { data, error } = await (supabase as any)
        .from("catalog_documents")
        .select("*")
        .eq("catalog_id", catalogId)
        .order("document_type")
        .order("created_at");
      if (error) throw error;
      return (data || []) as CatalogDocument[];
    },
    enabled: !!catalogId,
  });
}

export function useUploadCatalogDocument() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      file,
      catalogId,
      title,
      documentType,
      language,
    }: {
      file: File;
      catalogId: string;
      title: string;
      documentType: string;
      language: string;
    }) => {
      if (!user) throw new Error("Must be logged in");

      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const filePath = `${catalogId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("catalog-documents")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data, error } = await (supabase as any)
        .from("catalog_documents")
        .insert({
          catalog_id: catalogId,
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
        await supabase.storage.from("catalog-documents").remove([filePath]);
        throw error;
      }

      return data as CatalogDocument;
    },
    onSuccess: (_: unknown, v: { file: File; catalogId: string; title: string; documentType: string; language: string }) => {
      qc.invalidateQueries({ queryKey: ["catalog-documents", v.catalogId] });
    },
  });
}

export function useDeleteCatalogDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ doc }: { doc: CatalogDocument }) => {
      await supabase.storage.from("catalog-documents").remove([doc.file_path]);
      const { error } = await (supabase as any)
        .from("catalog_documents")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: (_: unknown, v: { doc: CatalogDocument }) => {
      qc.invalidateQueries({ queryKey: ["catalog-documents", v.doc.catalog_id] });
    },
  });
}

export async function getSignedCatalogDocumentUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("catalog-documents")
    .createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
