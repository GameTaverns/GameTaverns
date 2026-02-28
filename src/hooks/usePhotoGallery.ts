import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { extractMentions, resolveUsernames } from "@/hooks/useMentionAutocomplete";

export type MediaType = "image" | "video";

export interface UserPhoto {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  media_type: MediaType;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  like_count?: number;
  liked_by_me?: boolean;
}

export function useUserPhotos(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-photos", userId],
    queryFn: async (): Promise<UserPhoto[]> => {
      if (!userId) return [];

      const { data: { user } } = await supabase.auth.getUser();
      const myId = user?.id;

      // Fetch own photos
      const { data: ownPhotos, error } = await supabase
        .from("user_photos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch photos where this user is tagged (using rpc-style raw query for untyped table)
      const { data: taggedRows } = await (supabase as any)
        .from("photo_tags")
        .select("photo_id")
        .eq("tagged_user_id", userId);

      let taggedPhotos: any[] = [];
      if (taggedRows?.length) {
        const taggedIds = taggedRows.map((t: any) => t.photo_id);
        const { data } = await supabase
          .from("user_photos")
          .select("*")
          .in("id", taggedIds)
          .order("created_at", { ascending: false });
        taggedPhotos = data || [];
      }

      // Merge & deduplicate
      const allPhotosMap = new Map<string, any>();
      for (const p of [...(ownPhotos || []), ...taggedPhotos]) {
        if (!allPhotosMap.has(p.id)) allPhotosMap.set(p.id, p);
      }
      const allPhotos = Array.from(allPhotosMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (!allPhotos.length) return [];

      // Get like counts
      const photoIds = allPhotos.map((p: any) => p.id);
      const { data: likes } = await supabase
        .from("photo_likes")
        .select("photo_id, user_id")
        .in("photo_id", photoIds);

      const likeCounts: Record<string, number> = {};
      const myLikes = new Set<string>();
      for (const like of likes || []) {
        likeCounts[like.photo_id] = (likeCounts[like.photo_id] || 0) + 1;
        if (like.user_id === myId) myLikes.add(like.photo_id);
      }

      return allPhotos.map((p: any) => ({
        ...p,
        media_type: p.media_type || "image",
        like_count: likeCounts[p.id] || 0,
        liked_by_me: myLikes.has(p.id),
      }));
    },
    enabled: !!userId,
  });
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ files, caption }: { files: File[]; caption?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (const file of files) {
        const isVideo = file.type.startsWith("video/");
        const mediaType: MediaType = isVideo ? "video" : "image";
        const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("user-photos")
          .upload(path, file, { contentType: file.type, upsert: false });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: urlData } = supabase.storage
          .from("user-photos")
          .getPublicUrl(path);

        if (!urlData?.publicUrl) throw new Error("Failed to get public URL");

        // For videos, generate a thumbnail from the first frame
        let thumbnailUrl: string | null = null;
        if (isVideo) {
          try {
            thumbnailUrl = await generateVideoThumbnail(file, user.id);
          } catch (e) {
            console.warn("Thumbnail generation failed, continuing without:", e);
          }
        }

        const { data: insertedData, error: insertError } = await (supabase as any)
          .from("user_photos")
          .insert({
            user_id: user.id,
            image_url: urlData.publicUrl,
            caption: caption?.trim() || null,
            media_type: mediaType,
            thumbnail_url: thumbnailUrl,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        // Insert photo tags from @mentions in caption
        if (caption && insertedData?.id) {
          const mentions = extractMentions(caption);
          if (mentions.length > 0) {
            const usernameMap = await resolveUsernames(mentions);
            const tagRows = Object.values(usernameMap)
              .filter(uid => uid !== user.id) // don't tag yourself
              .map(uid => ({
                photo_id: insertedData.id,
                tagged_user_id: uid,
                tagged_by: user.id,
              }));
            if (tagRows.length > 0) {
              await (supabase as any).from("photo_tags").insert(tagRows);
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-photos"] });
    },
  });
}

async function generateVideoThumbnail(file: File, userId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = async () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(video.videoWidth, 480);
        canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) { resolve(null); return; }

          const thumbPath = `${userId}/thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
          const { error } = await supabase.storage
            .from("user-photos")
            .upload(thumbPath, blob, { contentType: "image/jpeg", upsert: false });

          if (error) { resolve(null); return; }

          const { data } = supabase.storage.from("user-photos").getPublicUrl(thumbPath);
          resolve(data?.publicUrl || null);
        }, "image/jpeg", 0.7);
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    // Timeout fallback
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 10000);
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase
        .from("user_photos")
        .delete()
        .eq("id", photoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-photos"] });
    },
  });
}

export function useTogglePhotoLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, liked }: { photoId: string; liked: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (liked) {
        const { error } = await supabase
          .from("photo_likes")
          .delete()
          .eq("photo_id", photoId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("photo_likes")
          .insert({ photo_id: photoId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-photos"] });
    },
  });
}
