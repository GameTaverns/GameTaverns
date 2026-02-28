import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface UserPhoto {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
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

      const { data, error } = await supabase
        .from("user_photos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data?.length) return [];

      // Get like counts
      const photoIds = data.map((p: any) => p.id);
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

      return data.map((p: any) => ({
        ...p,
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
    mutationFn: async ({ file, caption }: { file: File; caption?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("user-photos")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from("user-photos")
        .getPublicUrl(path);

      if (!urlData?.publicUrl) throw new Error("Failed to get public URL");

      const { error: insertError } = await supabase
        .from("user_photos")
        .insert({
          user_id: user.id,
          image_url: urlData.publicUrl,
          caption: caption?.trim() || null,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-photos"] });
    },
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
