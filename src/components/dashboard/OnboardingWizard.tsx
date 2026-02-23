import { useState, useMemo } from "react";
import {
  Check, ChevronRight, ChevronLeft, X, Upload, Palette,
  Library, Gamepad2, Star, Shield, Sparkles, ExternalLink
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getLibraryUrl, getPlatformUrl } from "@/hooks/useTenantUrl";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WizardStep {
  id: string;
  title: string;
  description: string;
  detail: string;
  icon: React.ReactNode;
  completed: boolean;
  href?: string;
  action?: string;
}

interface OnboardingWizardProps {
  librarySlug: string;
  gameCount: number;
  playCount: number;
  memberCount: number;
  hasCustomTheme: boolean;
  hasEvents: boolean;
  has2FA?: boolean;
}

const DISMISSED_KEY = "onboarding_wizard_dismissed";

export function OnboardingWizard({
  librarySlug,
  gameCount,
  playCount,
  memberCount,
  hasCustomTheme,
  hasEvents,
  has2FA = false,
}: OnboardingWizardProps) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const gamesUrl = getLibraryUrl(librarySlug, "/games");
  const libraryUrl = getLibraryUrl(librarySlug, "/");
  const dashboardLibraryUrl = getPlatformUrl("/dashboard?tab=library");
  const dashboardCommunityUrl = getPlatformUrl("/dashboard?tab=community");

  const steps: WizardStep[] = useMemo(() => [
    {
      id: "setup-2fa",
      title: "Secure your account",
      description: "Set up two-factor authentication",
      detail: "Protect your account with an authenticator app. This adds an extra layer of security beyond just your password. Once enabled, you'll need your phone to log in.",
      icon: <Shield className="h-6 w-6" />,
      completed: has2FA,
      href: getPlatformUrl("/setup-2fa"),
      action: "Set Up 2FA",
    },
    {
      id: "add-games",
      title: "Build your collection",
      description: "Add your first games to your library",
      detail: "Import your collection from BoardGameGeek, upload a CSV file, or add games one by one. Your library is where your entire collection lives — searchable, sortable, and shareable.",
      icon: <Upload className="h-6 w-6" />,
      completed: gameCount > 0,
      href: gamesUrl!,
      action: "Import Games",
    },
    {
      id: "customize-theme",
      title: "Make it yours",
      description: "Customize your library's look and feel",
      detail: "Upload a logo, choose your colors, and set your branding. Each library gets its own subdomain — make it feel like home for your gaming group.",
      icon: <Palette className="h-6 w-6" />,
      completed: hasCustomTheme,
      href: dashboardLibraryUrl,
      action: "Customize Theme",
    },
    {
      id: "share-library",
      title: "Invite your friends",
      description: "Share your library with your gaming group",
      detail: `Your library is live at ${librarySlug}.gametaverns.com — share the link with friends so they can browse your collection, request to borrow games, and join your community.`,
      icon: <Library className="h-6 w-6" />,
      completed: memberCount > 1,
      href: libraryUrl!,
      action: "View Library",
    },
    {
      id: "log-play",
      title: "Track a game session",
      description: "Log who played and who won",
      detail: "Record your game sessions to build play history, track win rates, and unlock achievements. Tag friends to compare stats and climb the leaderboard.",
      icon: <Gamepad2 className="h-6 w-6" />,
      completed: playCount > 0,
      href: libraryUrl!,
      action: "Browse Games",
    },
    {
      id: "explore-features",
      title: "Explore community features",
      description: "Events, lending, polls, and more",
      detail: "Set up game night events with RSVP, enable game lending with tracking, create polls to pick what to play next, and engage your community through forums and clubs.",
      icon: <Star className="h-6 w-6" />,
      completed: hasEvents,
      href: dashboardCommunityUrl,
      action: "Explore Community",
    },
  ], [has2FA, gameCount, hasCustomTheme, memberCount, playCount, hasEvents, librarySlug, gamesUrl, libraryUrl, dashboardLibraryUrl, dashboardCommunityUrl]);

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = (completedCount / steps.length) * 100;
  const allComplete = completedCount === steps.length;
  const step = steps[currentStep];

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
    setWizardOpen(false);
  };

  // Find next incomplete step
  const nextIncomplete = steps.findIndex(s => !s.completed);

  if (dismissed && allComplete) return null;

  return (
    <>
      {/* Compact banner trigger */}
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-xl border p-4 cursor-pointer transition-all hover:shadow-lg",
            allComplete
              ? "bg-secondary/10 border-secondary/30"
              : "bg-wood-medium/30 border-secondary/50 shadow-[0_0_12px_-3px_hsl(var(--secondary)/0.3)]"
          )}
          onClick={() => {
            if (!allComplete) {
              setCurrentStep(nextIncomplete >= 0 ? nextIncomplete : 0);
            }
            setWizardOpen(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className={cn(
                "h-5 w-5 text-secondary",
                !allComplete && "animate-pulse"
              )} />
              <div>
                <p className="text-sm font-semibold text-cream">
                  {allComplete ? "You're all set! 🎉" : "Getting Started"}
                </p>
                <p className="text-xs text-cream/50">
                  {allComplete
                    ? "All steps completed — you're ready to go!"
                    : `${completedCount}/${steps.length} steps completed — click to continue`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Progress
                value={progressPercent}
                className="h-2 w-24 bg-wood-medium/40 [&>div]:bg-secondary"
              />
              <span className="text-xs text-cream/60 whitespace-nowrap">{completedCount}/{steps.length}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-cream/40 hover:text-cream hover:bg-wood-medium/40"
                onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Wizard dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="bg-wood-dark border-wood-medium/60 text-cream sm:max-w-lg p-0 overflow-hidden">
          {/* Progress bar */}
          <div className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between mb-3">
              <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-secondary" />
                Getting Started
              </DialogTitle>
              <span className="text-xs text-cream/50">Step {currentStep + 1} of {steps.length}</span>
            </div>
            <Progress
              value={((currentStep + 1) / steps.length) * 100}
              className="h-1.5 bg-wood-medium/40 [&>div]:bg-secondary mb-4"
            />
            {/* Step dots */}
            <div className="flex items-center gap-1.5 mb-4">
              {steps.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(i)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === currentStep ? "w-6 bg-secondary" : s.completed ? "w-2 bg-secondary/50" : "w-2 bg-wood-medium/60"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="px-6 pb-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0",
                  step.completed
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-wood-medium/30 text-cream/70 border border-wood-medium/50"
                )}>
                  {step.completed ? <Check className="h-6 w-6" /> : step.icon}
                </div>
                <div>
                  <h3 className={cn(
                    "text-base font-semibold mb-1",
                    step.completed && "text-cream/60"
                  )}>
                    {step.title}
                    {step.completed && <Check className="h-4 w-4 inline ml-2 text-secondary" />}
                  </h3>
                  <p className="text-sm text-cream/60">{step.description}</p>
                </div>
              </div>

              <p className="text-sm text-cream/50 leading-relaxed mb-6">{step.detail}</p>

              {/* Action button */}
              {!step.completed && step.href && (
                <Link to={step.href} onClick={() => setWizardOpen(false)}>
                  <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2">
                    {step.action}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
              {step.completed && (
                <div className="text-center py-2">
                  <Badge className="bg-secondary/20 text-secondary border-secondary/30">
                    <Check className="h-3 w-3 mr-1" /> Completed
                  </Badge>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-wood-medium/40 bg-wood-medium/10">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="text-cream/60 hover:text-cream gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-cream/40 hover:text-cream text-xs"
              >
                Skip for now
              </Button>
              {currentStep < steps.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  className="bg-secondary text-secondary-foreground gap-1"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setWizardOpen(false)}
                  className="bg-secondary text-secondary-foreground"
                >
                  Done
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
