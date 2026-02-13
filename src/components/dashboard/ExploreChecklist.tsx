import { useState, useEffect } from "react";
import {
  Check, ChevronDown, ChevronUp, Compass, X,
  Gamepad2, Vote, Globe, MessageSquare, Users,
  Calendar, Trophy, ArrowLeftRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getLibraryUrl, getPlatformUrl } from "@/hooks/useTenantUrl";
import { motion, AnimatePresence } from "framer-motion";

interface ExploreItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  href?: string;
  action?: string;
}

interface ExploreChecklistProps {
  librarySlug: string;
  hasPlaySessions: boolean;
  hasPolls: boolean;
  hasBggSync: boolean;
  hasForum: boolean;
  hasClubs: boolean;
  hasEvents: boolean;
  hasAchievements: boolean;
  hasTrades: boolean;
}

const STORAGE_KEY = "explore_checklist_dismissed";
const STORAGE_COLLAPSED_KEY = "explore_checklist_collapsed";

export function ExploreChecklist({
  librarySlug,
  hasPlaySessions,
  hasPolls,
  hasBggSync,
  hasForum,
  hasClubs,
  hasEvents,
  hasAchievements,
  hasTrades,
}: ExploreChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    return localStorage.getItem(STORAGE_COLLAPSED_KEY) !== "true";
  });

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") setDismissed(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem(STORAGE_COLLAPSED_KEY, next ? "false" : "true");
  };

  const settingsUrl = getLibraryUrl(librarySlug, "/settings");
  const libraryUrl = getLibraryUrl(librarySlug, "/");

  const items: ExploreItem[] = [
    {
      id: "log-play",
      title: "Log a play session",
      description: "Track who played, scores, winners, and build your play history over time.",
      icon: <Gamepad2 className="h-4 w-4" />,
      completed: hasPlaySessions,
      href: libraryUrl!,
      action: "Browse Games",
    },
    {
      id: "create-poll",
      title: "Create a game night poll",
      description: "Let your group vote on what to play next — great for planning game nights.",
      icon: <Vote className="h-4 w-4" />,
      completed: hasPolls,
      href: getPlatformUrl("/dashboard?tab=polls"),
      action: "Create Poll",
    },
    {
      id: "schedule-event",
      title: "Schedule a game night",
      description: "Create events with dates, locations, and optional Discord integration.",
      icon: <Calendar className="h-4 w-4" />,
      completed: hasEvents,
      href: getPlatformUrl("/dashboard?tab=events"),
      action: "Plan Event",
    },
    {
      id: "bgg-sync",
      title: "Sync with BoardGameGeek",
      description: "Link your BGG account to auto-import your collection and keep it in sync.",
      icon: <Globe className="h-4 w-4" />,
      completed: hasBggSync,
      href: settingsUrl!,
      action: "Connect BGG",
    },
    {
      id: "explore-forum",
      title: "Start a community discussion",
      description: "Enable your library's community forum and create your first thread.",
      icon: <MessageSquare className="h-4 w-4" />,
      completed: hasForum,
      href: getPlatformUrl("/dashboard?tab=community"),
      action: "Open Forum",
    },
    {
      id: "join-club",
      title: "Join or create a club",
      description: "Connect with other libraries in a shared club for cross-library events and catalogs.",
      icon: <Users className="h-4 w-4" />,
      completed: hasClubs,
      href: getPlatformUrl("/dashboard?tab=clubs"),
      action: "Explore Clubs",
    },
    {
      id: "earn-achievement",
      title: "Unlock an achievement",
      description: "Earn badges for milestones like logging plays, growing your collection, and more.",
      icon: <Trophy className="h-4 w-4" />,
      completed: hasAchievements,
      href: getPlatformUrl("/dashboard?tab=library"),
      action: "View Achievements",
    },
    {
      id: "try-trades",
      title: "List a game for trade",
      description: "Mark games you'd trade and discover matches with other libraries.",
      icon: <ArrowLeftRight className="h-4 w-4" />,
      completed: hasTrades,
      href: getPlatformUrl("/dashboard?tab=trades"),
      action: "Open Trades",
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const progressPercent = (completedCount / items.length) * 100;
  const allComplete = completedCount === items.length;

  if (dismissed) return null;

  // Show incomplete items first, completed at bottom
  const sortedItems = [...items].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });

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
              <Compass className="h-5 w-5 text-primary" />
              {allComplete ? "Explorer Extraordinaire! 🏆" : "Explore More Features"}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-cream/60 hover:text-cream hover:bg-wood-medium/40"
                onClick={handleToggle}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-cream/60 hover:text-cream hover:bg-wood-medium/40"
                onClick={handleDismiss}
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-cream/50 mt-1">
            Discover what makes your library special — try these features at your own pace.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Progress
              value={progressPercent}
              className="h-2 flex-1 bg-wood-medium/40 [&>div]:bg-primary"
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
                  {sortedItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg transition-colors",
                        item.completed
                          ? "bg-primary/5 opacity-60"
                          : "bg-wood-medium/20 hover:bg-wood-medium/30"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full border-2 flex-shrink-0 mt-0.5",
                          item.completed
                            ? "border-primary bg-primary text-primary-foreground"
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
                            variant="outline"
                            className="border-primary/50 text-cream hover:bg-primary/20 text-xs h-7"
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
                      You've explored every feature — you're a power user! 🎉
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDismiss}
                      className="border-primary/50 text-cream"
                    >
                      Dismiss
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
