import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface NotificationPreferences {
  id: string;
  user_id: string;
  // Email notifications
  email_loan_requests: boolean;
  email_loan_updates: boolean;
  email_event_reminders: boolean;
  email_wishlist_alerts: boolean;
  email_achievement_earned: boolean;
  // Push notifications
  push_loan_requests: boolean;
  push_loan_updates: boolean;
  push_event_reminders: boolean;
  push_wishlist_alerts: boolean;
  push_achievement_earned: boolean;
  // Discord notifications
  discord_loan_requests: boolean;
  discord_loan_updates: boolean;
  discord_event_reminders: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  email_loan_requests: true,
  email_loan_updates: true,
  email_event_reminders: true,
  email_wishlist_alerts: true,
  email_achievement_earned: true,
  push_loan_requests: true,
  push_loan_updates: true,
  push_event_reminders: true,
  push_wishlist_alerts: false,
  push_achievement_earned: true,
  discord_loan_requests: true,
  discord_loan_updates: true,
  discord_event_reminders: true,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's notification preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // If no preferences exist, create default ones
      if (error?.code === "PGRST116") {
        const { data: newPrefs, error: insertError } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user.id, ...DEFAULT_PREFERENCES })
          .select()
          .single();

        if (insertError) throw insertError;
        return newPrefs as NotificationPreferences;
      }

      if (error) throw error;
      return data as NotificationPreferences;
    },
    enabled: !!user,
  });

  // Update preferences
  const updatePreferences = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!user) throw new Error("Must be logged in");

      const { data, error } = await supabase
        .from("notification_preferences")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data as NotificationPreferences;
    },
    onSuccess: () => {
      toast.success("Preferences saved");
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
    onError: (error) => {
      toast.error("Failed to save preferences: " + error.message);
    },
  });

  // Toggle a specific preference
  const togglePreference = (key: keyof Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!preferences) return;
    
    updatePreferences.mutate({
      [key]: !preferences[key],
    });
  };

  // Bulk update by channel
  const setChannelEnabled = (channel: 'email' | 'push' | 'discord', enabled: boolean) => {
    const updates: Partial<NotificationPreferences> = {};
    
    if (channel === 'email') {
      updates.email_loan_requests = enabled;
      updates.email_loan_updates = enabled;
      updates.email_event_reminders = enabled;
      updates.email_wishlist_alerts = enabled;
      updates.email_achievement_earned = enabled;
    } else if (channel === 'push') {
      updates.push_loan_requests = enabled;
      updates.push_loan_updates = enabled;
      updates.push_event_reminders = enabled;
      updates.push_wishlist_alerts = enabled;
      updates.push_achievement_earned = enabled;
    } else if (channel === 'discord') {
      updates.discord_loan_requests = enabled;
      updates.discord_loan_updates = enabled;
      updates.discord_event_reminders = enabled;
    }

    updatePreferences.mutate(updates);
  };

  return {
    preferences,
    isLoading,
    updatePreferences,
    togglePreference,
    setChannelEnabled,
  };
}
