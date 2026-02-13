import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

/** A small sidebar link that nudges owners to complete onboarding */
export function OnboardingSidebarLink() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const isDismissed = localStorage.getItem("onboarding_checklist_dismissed");
    setDismissed(isDismissed === "true");
  }, []);

  if (dismissed) return null;

  return (
    <Link to="/dashboard?tab=library" className="block px-4 mt-4">
      <div className="p-3 rounded-lg bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sidebar-primary" />
          <span className="text-xs font-semibold text-sidebar-foreground">
            Finish Getting Started
          </span>
        </div>
        <p className="text-[10px] text-sidebar-foreground/60 mt-1">
          Complete your library setup checklist
        </p>
      </div>
    </Link>
  );
}
