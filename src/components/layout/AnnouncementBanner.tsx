import { useSiteSettings } from "@/hooks/useSiteSettings";
import { X } from "lucide-react";
import { useState, useEffect } from "react";

export function AnnouncementBanner() {
  const { data: settings } = useSiteSettings();
  const [dismissed, setDismissed] = useState(false);
  
  const announcement = settings?.announcement_banner;
  
  // Reset dismissed state when announcement changes
  useEffect(() => {
    if (announcement) {
      const storedDismissed = sessionStorage.getItem("announcement_dismissed");
      const storedMessage = sessionStorage.getItem("announcement_message");
      
      // Only keep dismissed if it's the same message
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
  
  if (!announcement || dismissed) {
    return null;
  }
  
  return (
    <div className="bg-primary text-primary-foreground px-4 py-2 text-center text-sm relative">
      <p className="pr-8">{announcement}</p>
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

