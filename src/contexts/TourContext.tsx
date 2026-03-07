import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

export interface TourStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  route: string;
  completionKey: string;
  actionLabelKey: string;
  emoji?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    titleKey: "tour.welcomeTitle",
    descriptionKey: "tour.welcomeDesc",
    route: "/dashboard",
    completionKey: "welcome_seen",
    actionLabelKey: "tour.letsGo",
    emoji: "🎲",
  },
  {
    id: "create-library",
    titleKey: "tour.createLibraryTitle",
    descriptionKey: "tour.createLibraryDesc",
    route: "/create-library",
    completionKey: "has_library",
    actionLabelKey: "tour.createLibraryAction",
    emoji: "📚",
  },
  {
    id: "import-games",
    titleKey: "tour.importGamesTitle",
    descriptionKey: "tour.importGamesDesc",
    route: "__library_games__",
    completionKey: "has_games",
    actionLabelKey: "tour.addGamesAction",
    emoji: "🎮",
  },
  {
    id: "customize-theme",
    titleKey: "tour.customizeTitle",
    descriptionKey: "tour.customizeDesc",
    route: "__library_settings__",
    completionKey: "has_custom_theme",
    actionLabelKey: "tour.openSettingsAction",
    emoji: "🎨",
  },
  {
    id: "setup-2fa",
    titleKey: "tour.secureTitle",
    descriptionKey: "tour.secureDesc",
    route: "/setup-2fa",
    completionKey: "has_2fa",
    actionLabelKey: "tour.setUp2FAAction",
    emoji: "🔒",
  },
  {
    id: "complete",
    titleKey: "tour.completeTitle",
    descriptionKey: "tour.completeDesc",
    route: "/dashboard",
    completionKey: "tour_complete",
    actionLabelKey: "tour.finishTourAction",
    emoji: "🎉",
  },
];

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: () => void;
  endTour: () => void;
  deferTour: () => void;
  completeStep: (completionKey: string) => void;
  skipStep: () => void;
  shouldShowTour: boolean;
  completions: Record<string, boolean>;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(() => {
    return localStorage.getItem("guided_tour_active") === "true";
  });
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem("guided_tour_step");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [hasSeenTour, setHasSeenTour] = useState(true);
  const [completions, setCompletions] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("guided_tour_completions");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const navigate = useNavigate();
  const location = useLocation();
  const dbCheckDone = useRef(false);

  // Persist tour state to localStorage so it survives cross-domain navigation
  useEffect(() => {
    localStorage.setItem("guided_tour_active", String(isActive));
  }, [isActive]);

  useEffect(() => {
    localStorage.setItem("guided_tour_step", String(currentStep));
  }, [currentStep]);

  useEffect(() => {
    localStorage.setItem("guided_tour_completions", JSON.stringify(completions));
  }, [completions]);

  // Check if user has seen the tour — use both localStorage AND database
  useEffect(() => {
    const seen = localStorage.getItem("guided_tour_seen");
    const deferred = localStorage.getItem("guided_tour_deferred");

    if (seen === "true") {
      setHasSeenTour(true);
      return;
    }

    if (deferred) {
      const deferredAt = new Date(deferred).getTime();
      if (Date.now() - deferredAt < 24 * 60 * 60 * 1000) {
        setHasSeenTour(true);
        return;
      }
    }

    // Check the database for tour_complete achievement as a fallback.
    // This covers cases where localStorage was cleared (e.g. native app restart).
    if (user && !dbCheckDone.current) {
      dbCheckDone.current = true;
      (async () => {
        try {
          const { data: achievement } = await supabase
            .from("achievements")
            .select("id")
            .eq("slug", "tour_complete")
            .maybeSingle();
          if (!achievement) { setHasSeenTour(false); return; }

          const { data: userAchievement } = await supabase
            .from("user_achievements")
            .select("id")
            .eq("user_id", user.id)
            .eq("achievement_id", achievement.id)
            .maybeSingle();

          if (userAchievement) {
            // User already completed tour — persist to localStorage too
            localStorage.setItem("guided_tour_seen", "true");
            setHasSeenTour(true);
          } else {
            setHasSeenTour(false);
          }
        } catch {
          setHasSeenTour(false);
        }
      })();
    } else if (!user) {
      // Not logged in — don't show tour
      setHasSeenTour(true);
    }
  }, [user]);

  // On resume: skip past all already-completed steps in one go
  useEffect(() => {
    if (!isActive) return;
    let nextStep = currentStep;
    while (nextStep < TOUR_STEPS.length - 1) {
      const step = TOUR_STEPS[nextStep];
      if (!step) break;
      // Don't auto-skip welcome or complete — those are manual
      if (step.completionKey === "welcome_seen" || step.completionKey === "tour_complete") break;
      if (!completions[step.completionKey]) break;
      nextStep++;
    }
    if (nextStep !== currentStep) {
      setCurrentStep(nextStep);
    }
  }, [isActive]); // Only on mount/resume

  // Auto-advance when a step's completion key becomes true (skip multiple if needed)
  useEffect(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[currentStep];
    if (!step) return;
    if (step.completionKey === "welcome_seen" || step.completionKey === "tour_complete") return;

    if (completions[step.completionKey]) {
      // Find the next incomplete step
      let nextStep = currentStep + 1;
      while (nextStep < TOUR_STEPS.length - 1) {
        const s = TOUR_STEPS[nextStep];
        if (s.completionKey === "welcome_seen" || s.completionKey === "tour_complete") break;
        if (!completions[s.completionKey]) break;
        nextStep++;
      }
      const timer = setTimeout(() => {
        setCurrentStep(nextStep);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [completions, currentStep, isActive]);

  // Navigation is intentionally NOT automatic on step change.
  // Users navigate via the action button in the GuidedTour component.

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const endTour = useCallback(async () => {
    localStorage.setItem("guided_tour_seen", "true");
    localStorage.removeItem("guided_tour_active");
    localStorage.removeItem("guided_tour_step");
    localStorage.removeItem("guided_tour_completions");
    setIsActive(false);
    setHasSeenTour(true);

    // Award tour_complete achievement
    if (user) {
      try {
        const { data: achievement } = await supabase
          .from("achievements")
          .select("id")
          .eq("slug", "tour_complete")
          .maybeSingle();

        if (achievement) {
          await supabase
            .from("user_achievements")
            .upsert(
              { user_id: user.id, achievement_id: achievement.id, progress: 1 },
              { onConflict: "user_id,achievement_id" }
            );
        }
      } catch (e) {
        console.error("Failed to award tour achievement:", e);
      }
    }

    navigate("/dashboard");
  }, [navigate, user]);

  const deferTour = useCallback(() => {
    // Permanently dismiss (not just 24h) — users who X the tour don't want to see it again
    localStorage.setItem("guided_tour_seen", "true");
    localStorage.removeItem("guided_tour_active");
    localStorage.removeItem("guided_tour_step");
    localStorage.removeItem("guided_tour_completions");
    setIsActive(false);
    setHasSeenTour(true);
  }, []);

  const completeStep = useCallback((completionKey: string) => {
    setCompletions((prev) => ({ ...prev, [completionKey]: true }));
  }, []);

  const skipStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      endTour();
    }
  }, [currentStep, endTour]);

  const shouldShowTour = !hasSeenTour && !isActive;

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        steps: TOUR_STEPS,
        startTour,
        endTour,
        deferTour,
        completeStep,
        skipStep,
        shouldShowTour,
        completions,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}
