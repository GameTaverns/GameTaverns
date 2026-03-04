import { useEffect } from "react";
import { supabase } from "@/integrations/backend/client";

/**
 * Records an anonymous view when someone visits a public library page.
 * Debounced: only records once per library per browser session.
 */
export function useLibraryViewTracking(libraryId: string | undefined, isOwner: boolean) {
  useEffect(() => {
    if (!libraryId || isOwner) return; // Don't count owner's own views

    const sessionKey = `lv_${libraryId}`;
    const alreadyViewed = sessionStorage.getItem(sessionKey);
    if (alreadyViewed) return;

    // Generate a simple anonymous hash from random value (no PII)
    const viewerHash = Math.random().toString(36).substring(2, 15);

    // Fire-and-forget insert
    supabase
      .from("library_views")
      .insert({
        library_id: libraryId,
        viewer_hash: viewerHash,
        page_path: window.location.pathname,
        referrer: document.referrer || null,
      })
      .then(() => {
        sessionStorage.setItem(sessionKey, "1");
      });
  }, [libraryId, isOwner]);
}
