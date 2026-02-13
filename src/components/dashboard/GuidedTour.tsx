import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";

interface TourStep {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to GameTaverns! 🎲",
    description:
      "This is your dashboard — the command center for managing your board game library, community, and events. Let's take a quick tour!",
  },
  {
    title: "Create Your Library",
    description:
      "Start by creating a library. It gets its own subdomain (e.g., yourname.gametaverns.com) where friends can browse your collection.",
  },
  {
    title: "Import Your Games",
    description:
      "Add games manually, import from a CSV file, or sync directly from BoardGameGeek. Your entire collection in one place.",
  },
  {
    title: "Customize Your Theme",
    description:
      "Make your library uniquely yours with custom colors, fonts, logos, and background images. Go to Library Settings to get started.",
  },
  {
    title: "Engage Your Community",
    description:
      "Enable features like game lending, play logging, polls, events, and forums. Toggle them on in your Library Settings → Feature Flags.",
  },
  {
    title: "Secure Your Account",
    description:
      "We recommend setting up two-factor authentication (2FA) to protect your account. You can do this from Account Settings or the checklist below.",
  },
  {
    title: "You're Ready! 🎉",
    description:
      "That's the basics! Check the Getting Started checklist on the Library tab for guided next steps. Have fun building your game tavern!",
  },
];

export function GuidedTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(true);

  useEffect(() => {
    const seen = localStorage.getItem("guided_tour_seen");
    const deferred = localStorage.getItem("guided_tour_deferred");

    if (seen === "true") {
      setHasSeenTour(true);
      return;
    }

    // If deferred, check if it's been more than 24 hours
    if (deferred) {
      const deferredAt = new Date(deferred).getTime();
      const now = Date.now();
      if (now - deferredAt < 24 * 60 * 60 * 1000) {
        setHasSeenTour(true);
        return;
      }
    }

    setHasSeenTour(false);
    // Auto-show tour for new users after a brief delay
    const timer = setTimeout(() => setIsActive(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleComplete();
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    localStorage.setItem("guided_tour_seen", "true");
    setIsActive(false);
    setHasSeenTour(true);
  }, []);

  const handleDefer = useCallback(() => {
    localStorage.setItem("guided_tour_deferred", new Date().toISOString());
    setIsActive(false);
    setHasSeenTour(true);
  }, []);

  if (hasSeenTour && !isActive) return null;

  const step = TOUR_STEPS[currentStep];
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleDefer}
          />

          {/* Tour Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardContent className="pt-6 pb-4">
                {/* Header with close */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-secondary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Step {currentStep + 1} of {TOUR_STEPS.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 -mt-1 -mr-1"
                    onClick={handleDefer}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Progress */}
                <Progress value={progress} className="h-1 mb-5" />

                {/* Content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-between mt-6">
                  <div className="flex gap-2">
                    {currentStep === 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDefer}
                        className="text-muted-foreground"
                      >
                        Show me later
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePrev}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {currentStep < TOUR_STEPS.length - 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleComplete}
                        className="text-muted-foreground"
                      >
                        Skip tour
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleNext}
                      className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                    >
                      {currentStep === TOUR_STEPS.length - 1 ? "Get Started" : "Next"}
                      {currentStep < TOUR_STEPS.length - 1 && (
                        <ChevronRight className="h-4 w-4 ml-1" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
