import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface MyInquiry {
  id: string;
  game_id: string;
  sender_name: string;
  message: string;
  is_read: boolean;
  created_at: string;
  game?: {
    title: string;
    slug: string | null;
    library_id: string | null;
    library_slug: string | null;
  } | null;
  replies?: {
    id: string;
    reply_text: string;
    created_at: string;
  }[];
}

export function useMyInquiries() {
  return useQuery({
    queryKey: ["my-inquiries"],
    queryFn: async (): Promise<MyInquiry[]> => {
      // Use edge function to decrypt and fetch user's inquiries
      const { data, error } = await supabase.functions.invoke("my-inquiries", {
        body: {},
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || "Failed to fetch inquiries");
      }

      return data.inquiries || [];
    },
  });
}

export function useUnreadReplyCount() {
  return useQuery({
    queryKey: ["my-inquiries", "unread-reply-count"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.functions.invoke("my-inquiries", {
        body: { countOnly: true },
      });

      if (error) throw error;
      return data?.unreadCount || 0;
    },
  });
}
