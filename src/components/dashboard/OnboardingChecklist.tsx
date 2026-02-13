import { useState, useEffect } from "react";
import { 
  Check, ChevronDown, ChevronUp, Library, Upload, Palette, 
  Users, Gamepad2, Star, Calendar, BookOpen, X, Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { motion, AnimatePresence } from "framer-motion";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  href?: string;
  action?: string;
}

interface OnboardingChecklistProps {
  librarySlug: string;
  gameCount: number;
  playCount: number;
  memberCount: number;
  hasCustomTheme: boolean;
  hasEvents: boolean;
}

export function OnboardingChecklist({
  librarySlug,
  gameCount,
  playCount,
  memberCount,
  hasCustomTheme,
  hasEvents,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Check localStorage for dismissal
  useEffect(() => {
    const isDismissed = localStorage.getItem("onboarding_checklist_dismissed");
    if (isDismissed === "true") setDismissed(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("onboarding_checklist_dismissed", "true");
    setDismissed(true);
  };

  const gamesUrl = getLibraryUrl(librarySlug, "/games");
  const settingsUrl = getLibraryUrl(librarySlug, "/settings");
  const libraryUrl = getLibraryUrl(librarySlug, "/");

  const items: ChecklistItem[] = [
    {
      id: "add-games",
      title: "Add your first games",
      description: "Import from BGG, CSV, or add games one by one to build your collection.",
      icon: <Upload className="h-4 w-4" />,
      completed: gameCount > 0,
      href: gamesUrl!,
      action: "Import Games",
    },
    {
      id: "customize-theme",
      title: "Customize your library look",
      description: "Set your logo, colors, and branding to make your library uniquely yours.",
      icon: <Palette className="h-4 w-4" />,
      completed: hasCustomTheme,
      href: settingsUrl!,
      action: "Open Settings",
    },
    {
      id: "share-library",
      title: "Share your library",
      description: `Your library is live at ${librarySlug}.gametaverns.com — share it with friends!`,
      icon: <Library className="h-4 w-4" />,
      completed: memberCount > 1,
      href: libraryUrl!,
      action: "View Library",
    },
    {
      id: "log-play",
      title: "Log a game session",
      description: "Track who played, who won, and build your play history over time.",
      icon: <Gamepad2 className="h-4 w-4" />,
      completed: playCount > 0,
      href: libraryUrl!,
      action: "Browse Games",
    },
    {
      id: "explore-features",
      title: "Explore community features",
      description: "Set up events, enable lending, create polls, and engage your community.",
      icon: <Star className="h-4 w-4" />,
      completed: hasEvents,
      href: settingsUrl!,
      action: "Explore Settings",
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const progressPercent = (completedCount / items.length) * 100;
  const allComplete = completedCount === items.length;

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream lg:col-span-3 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-secondary" />
              {allComplete ? "You're all set! 🎉" : "Getting Started"}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-cream/60 hover:text-cream hover:bg-wood-medium/40"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-cream/60 hover:text-cream hover:bg-wood-medium/40"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <Progress 
              value={progressPercent} 
              className="h-2 flex-1 bg-wood-medium/40 [&>div]:bg-secondary" 
            />
            <span className="text-xs text-cream/60 whitespace-nowrap">
              {completedCount}/{items.length}
            </span>
          </div>
        </CardHeader>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0 pb-4">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg transition-colors",
                        item.completed
                          ? "bg-secondary/10 opacity-70"
                          : "bg-wood-medium/20 hover:bg-wood-medium/30"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full border-2 flex-shrink-0 mt-0.5",
                          item.completed
                            ? "border-secondary bg-secondary text-secondary-foreground"
                            : "border-cream/30"
                        )}
                      >
                        {item.completed ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          item.icon
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          item.completed && "line-through text-cream/60"
                        )}>
                          {item.title}
                        </p>
                        <p className="text-xs text-cream/50 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                      {!item.completed && item.href && (
                        <a href={item.href} className="flex-shrink-0">
                          <Button
                            size="sm"
                            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs h-7"
                          >
                            {item.action}
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                {allComplete && (
                  <div className="mt-3 text-center">
                    <p className="text-sm text-cream/70 mb-2">
                      You've completed all the basics! Feel free to dismiss this checklist.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDismiss}
                      className="border-secondary/50 text-cream"
                    >
                      Dismiss Checklist
                    </Button>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
