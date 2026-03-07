import { useEffect } from "react";
import { X, ChevronRight, Sparkles, SkipForward, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { useTour } from "@/contexts/TourContext";
import { useNavigate } from "react-router-dom";
import { getLibraryUrl } from "@/hooks/useTenantUrl";

interface GuidedTourProps {
  librarySlug?: string;
}

export function GuidedTour({ librarySlug }: GuidedTourProps) {
  const { t } = useTranslation();
  const {
    isActive,
    currentStep,
    steps,
    startTour,
    endTour,
    deferTour,
    completeStep,
    skipStep,
    shouldShowTour,
    completions,
  } = useTour();
  const navigate = useNavigate();

  useEffect(() => {
    if (shouldShowTour) {
      const timer = setTimeout(() => startTour(), 1500);
      return () => clearTimeout(timer);
    }
  }, [shouldShowTour, startTour]);

  if (!isActive) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isStepComplete = completions[step.completionKey];

  const handleAction = () => {
    if (step.id === "welcome") {
      completeStep("welcome_seen");
      skipStep();
      return;
    }

    if (step.id === "complete") {
      endTour();
      return;
    }

    if (step.route.startsWith("__")) {
      if (!librarySlug) return;
      if (step.route === "__library_games__") {
        window.location.href = getLibraryUrl(librarySlug, "/games");
      } else if (step.route === "__library_settings__") {
        window.location.href = getLibraryUrl(librarySlug, "/settings");
      }
    } else {
      navigate(step.route);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed z-50 bottom-[76px] md:bottom-6 right-6 w-full max-w-sm px-4 sm:px-0"
      >
        <Card className="bg-card border-border shadow-2xl shadow-black/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-secondary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('tour.stepOf', { current: currentStep + 1, total: steps.length })}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -mt-1 -mr-1"
                onClick={deferTour}
                title={t('tour.closeTour')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Progress value={progress} className="h-1 mb-4" />

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{step.emoji}</span>
                  <h3 className="text-base font-display font-semibold text-foreground">
                    {t(step.titleKey)}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(step.descriptionKey)}
                </p>

                {isStepComplete && step.id !== "welcome" && step.id !== "complete" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-3 flex items-center gap-2 text-sm text-secondary font-medium"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('tour.doneMovingNext')}
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between mt-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={endTour}
                className="text-muted-foreground text-xs"
              >
                {t('tour.endTour')}
              </Button>

              <div className="flex gap-2">
                {step.id !== "welcome" && step.id !== "complete" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skipStep}
                    className="text-muted-foreground text-xs"
                  >
                    <SkipForward className="h-3 w-3 mr-1" />
                    {t('tour.skip')}
                  </Button>
                )}
                {!isStepComplete && (
                  <Button
                    size="sm"
                    onClick={handleAction}
                    className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  >
                    {t(step.actionLabelKey)}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
