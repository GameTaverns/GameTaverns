import { X } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase, apiClient, isSelfHostedMode } from "@/integrations/backend/client";

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.split("-")[0] || "en";
  
  // Fetch announcement directly from the public view
  const { data: announcement } = useQuery({
    queryKey: ["announcement-banner", isSelfHostedMode()],
    queryFn: async () => {
      if (isSelfHostedMode()) {
        try {
          const settings = await apiClient.get<Record<string, string | null>>('/settings/public');
          return settings.announcement_banner || null;
        } catch {
          return null;
        }
      }

      const { data, error } = await supabase
        .from("site_settings_public")
        .select("value")
        .eq("key", "announcement_banner")
        .maybeSingle();
      
      if (error) {
        console.error("Failed to fetch announcement:", error);
        return null;
      }
      
      return data?.value || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Translate the announcement if user's language is not English
  const { data: translatedAnnouncement } = useQuery({
    queryKey: ["announcement-translated", announcement, currentLang],
    queryFn: async () => {
      if (!announcement || currentLang === "en") return announcement;

      try {
        const { data, error } = await supabase.functions.invoke("translate-text", {
          body: { text: announcement, targetLanguage: currentLang },
        });

        if (error) {
          console.error("Translation error:", error);
          return announcement;
        }

        return data?.translatedText || announcement;
      } catch {
        return announcement;
      }
    },
    enabled: !!announcement,
    staleTime: 30 * 60 * 1000, // Cache translations for 30 min
  });

  const displayText = translatedAnnouncement || announcement;
  
  // Reset dismissed state when announcement changes
  useEffect(() => {
    if (announcement) {
      const storedDismissed = sessionStorage.getItem("announcement_dismissed");
      const storedMessage = sessionStorage.getItem("announcement_message");
      
      if (storedDismissed === "true" && storedMessage === announcement) {
        setDismissed(true);
      } else {
        setDismissed(false);
        sessionStorage.removeItem("announcement_dismissed");
      }
    }
  }, [announcement]);
  
  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("announcement_dismissed", "true");
    sessionStorage.setItem("announcement_message", announcement || "");
  };
  
  if (!displayText || dismissed) {
    return null;
  }
  
  return (
    <div className="bg-primary text-primary-foreground px-4 py-2 text-center text-sm relative">
      <p className="pr-8">{displayText}</p>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-primary-foreground/20 rounded transition-colors"
        aria-label="Dismiss announcement"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
