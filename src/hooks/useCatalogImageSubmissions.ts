import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "./useAuth";
import { validateImageFile } from "@/lib/fileValidation";

export interface CatalogImageSubmission {
  id: string;
  catalog_id: string;
  submitted_by: string;
  file_path: string;
  file_size_bytes: number | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  // Joined fields for admin view
  catalog_title?: string;
  catalog_slug?: string;
  submitter_name?: string;
}

/** Check if the current user is a trusted submitter (3+ approved) */
export function useTrustedSubmitter() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["trusted-image-submitter", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await (supabase as any).rpc(
        "is_trusted_image_submitter",
        { _user_id: user.id }
      );
      if (error) return false;
      return !!data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
}

/** Submit a new image for a catalog entry */
export function useSubmitCatalogImage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      file,
      catalogId,
    }: {
      file: File;
      catalogId: string;
    }) => {
      if (!user) throw new Error("Must be logged in");

      // Client-side validation with magic bytes
      const validation = await validateImageFile(file);
      if (!validation.valid) throw new Error(validation.error);

      // Check if user is trusted (auto-approve)
      const { data: isTrusted } = await (supabase as any).rpc(
        "is_trusted_image_submitter",
        { _user_id: user.id }
      );

      // Also check if user is admin
      const { data: isAdmin } = await (supabase as any).rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      const autoApprove = !!isTrusted || !!isAdmin;

      // Upload to storage
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${catalogId}/${user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("catalog-image-submissions")
        .upload(filePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      // Insert DB record
      const status = autoApprove ? "approved" : "pending";
      const { data, error } = await (supabase as any)
        .from("catalog_image_submissions")
        .insert({
          catalog_id: catalogId,
          submitted_by: user.id,
          file_path: filePath,
          file_size_bytes: file.size,
          status,
          ...(autoApprove
            ? { reviewed_by: user.id, reviewed_at: new Date().toISOString() }
            : {}),
        })
        .select()
        .single();

      if (error) {
        // Clean up orphaned file
        await supabase.storage
          .from("catalog-image-submissions")
          .remove([filePath]);
        throw error;
      }

      // If auto-approved, update the catalog image
      if (autoApprove) {
        const { data: urlData } = supabase.storage
          .from("catalog-image-submissions")
          .getPublicUrl(filePath);

        if (urlData?.publicUrl) {
          await (supabase as any)
            .from("game_catalog")
            .update({ image_url: urlData.publicUrl })
            .eq("id", catalogId);
        }
      }

      return { ...data, autoApproved: autoApprove };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["catalog-game"] });
      qc.invalidateQueries({ queryKey: ["catalog-image-submissions"] });
    },
  });
}

/** Admin: fetch pending image submissions */
export function usePendingImageSubmissions() {
  return useQuery({
    queryKey: ["catalog-image-submissions", "pending"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("catalog_image_submissions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;

      if (!data?.length) return [];

      // Fetch catalog titles
      const catalogIds = [...new Set(data.map((d: any) => d.catalog_id))] as string[];
      const { data: catalogs } = await supabase
        .from("game_catalog")
        .select("id, title, slug")
        .in("id", catalogIds);

      const catalogMap = new Map(
        (catalogs || []).map((c) => [c.id, c])
      );

      // Fetch submitter names
      const userIds = [...new Set(data.map((d: any) => d.submitted_by))] as string[];
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, username")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [
          p.user_id,
          p.display_name || p.username || "Unknown",
        ])
      );

      return data.map((d: any) => ({
        ...d,
        catalog_title: catalogMap.get(d.catalog_id)?.title || "Unknown Game",
        catalog_slug: catalogMap.get(d.catalog_id)?.slug,
        submitter_name: profileMap.get(d.submitted_by) || "Unknown",
      })) as CatalogImageSubmission[];
    },
  });
}

/** Admin: approve or reject a submission */
export function useReviewImageSubmission() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      submissionId,
      action,
      rejectionReason,
    }: {
      submissionId: string;
      action: "approved" | "rejected";
      rejectionReason?: string;
    }) => {
      if (!user) throw new Error("Must be logged in");

      // Get the submission first
      const { data: submission, error: fetchError } = await (supabase as any)
        .from("catalog_image_submissions")
        .select("*")
        .eq("id", submissionId)
        .single();

      if (fetchError) throw fetchError;

      // Update status
      const { error } = await (supabase as any)
        .from("catalog_image_submissions")
        .update({
          status: action,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          ...(action === "rejected" && rejectionReason
            ? { rejection_reason: rejectionReason }
            : {}),
        })
        .eq("id", submissionId);

      if (error) throw error;

      // If approved, update the catalog image
      if (action === "approved") {
        const { data: urlData } = supabase.storage
          .from("catalog-image-submissions")
          .getPublicUrl(submission.file_path);

        if (urlData?.publicUrl) {
          await (supabase as any)
            .from("game_catalog")
            .update({ image_url: urlData.publicUrl })
            .eq("id", submission.catalog_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog-image-submissions"] });
      qc.invalidateQueries({ queryKey: ["catalog-game"] });
    },
  });
}

/** Get public URL for a submission image */
export function getSubmissionImageUrl(filePath: string): string {
  const { data } = supabase.storage
    .from("catalog-image-submissions")
    .getPublicUrl(filePath);
  return data.publicUrl;
}
