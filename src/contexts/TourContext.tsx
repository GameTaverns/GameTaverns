import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export interface TourStep {
  id: string;
  title: string;
  description: string;
  route: string; // Route to navigate to for this step
  completionKey: string; // Key used to check if step action is done
  actionLabel: string; // Label for the action button shown in the card
  emoji?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to GameTaverns! 🎲",
    description: "This is your dashboard — the command center for your board game library. Let's walk through the key features by visiting each one!",
    route: "/dashboard",
    completionKey: "welcome_seen",
    actionLabel: "Let's Go!",
    emoji: "🎲",
  },
  {
    id: "create-library",
    title: "Create Your Library",
    description: "First, create a library. It gets its own subdomain (e.g., yourname.gametaverns.com) where friends can browse your collection.",
    route: "/create-library",
    completionKey: "has_library",
    actionLabel: "Create Library",
    emoji: "📚",
  },
  {
    id: "import-games",
    title: "Import Your Games",
    description: "Now let's add some games! Import from BoardGameGeek, a CSV file, or add games manually to build your collection.",
    route: "__library_games__", // Special: resolved dynamically
    completionKey: "has_games",
    actionLabel: "Add Games",
    emoji: "🎮",
  },
  {
    id: "customize-theme",
    title: "Customize Your Look",
    description: "Make your library uniquely yours — set a logo, pick colors, and choose fonts in Library Settings.",
    route: "__library_settings__", // Special: resolved dynamically
    completionKey: "has_custom_theme",
    actionLabel: "Open Settings",
    emoji: "🎨",
  },
  {
    id: "setup-2fa",
    title: "Secure Your Account",
    description: "Protect your account with two-factor authentication. It only takes a minute with any authenticator app.",
    route: "/setup-2fa",
    completionKey: "has_2fa",
    actionLabel: "Set Up 2FA",
    emoji: "🔒",
  },
  {
    id: "complete",
    title: "You're All Set! 🎉",
    description: "Great job! You've got the basics covered. Explore community features like lending, events, polls, and forums whenever you're ready.",
    route: "/dashboard",
    completionKey: "tour_complete",
    actionLabel: "Finish Tour",
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
  goToStep: (index: number) => void;
  hasSeenTour: boolean;
  shouldShowTour: boolean;
  completions: Record<string, boolean>;
  setCompletions: (completions: Record<string, boolean>) => void;
}

const TourContext = createContext<TourContextType | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(true);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user has seen the tour
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

    setHasSeenTour(false);
  }, []);

  // Auto-advance when a step's completion key becomes true
  useEffect(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    // Special: welcome step completes on "Let's Go!" click, not data
    if (step.completionKey === "welcome_seen" || step.completionKey === "tour_complete") return;

    if (completions[step.completionKey]) {
      // Step is complete — advance after a brief delay for feedback
      const timer = setTimeout(() => {
        if (currentStep < TOUR_STEPS.length - 1) {
          setCurrentStep((s) => s + 1);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [completions, currentStep, isActive]);

  // Navigate when step changes
  useEffect(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    // Skip navigation for dynamic routes (they're handled by the component)
    if (step.route.startsWith("__")) return;

    if (location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [currentStep, isActive]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const endTour = useCallback(() => {
    localStorage.setItem("guided_tour_seen", "true");
    setIsActive(false);
    setHasSeenTour(true);
    navigate("/dashboard");
  }, [navigate]);

  const deferTour = useCallback(() => {
    localStorage.setItem("guided_tour_deferred", new Date().toISOString());
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

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < TOUR_STEPS.length) {
      setCurrentStep(index);
    }
  }, []);

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
        goToStep,
        hasSeenTour,
        shouldShowTour,
        completions,
        setCompletions,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) throw new Error("useTour must be used within TourProvider");
  return context;
}
