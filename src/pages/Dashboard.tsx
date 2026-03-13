import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Shuffle } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileBottomTabs } from "@/components/mobile/MobileBottomTabs";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useUserProfile } from "@/hooks/useLibrary";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { TwoFactorBanner } from "@/components/dashboard/TwoFactorBanner";
import { GuidedTour } from "@/components/dashboard/GuidedTour";
import { Footer } from "@/components/layout/Footer";
import { RandomGamePicker } from "@/components/games/RandomGamePicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardActivityFeed } from "@/components/dashboard/DashboardActivityFeed";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import tavernBg from "@/assets/tavern-bg.jpg";

const MOTIVATIONAL_MESSAGES = [
  "Every game night is a memory waiting to happen. 🎲",
  "Life's too short for boring games — play something epic today!",
  "A good board game brings people together. What will you play next?",
  "Your shelf of opportunity awaits. Time to roll the dice! 🎯",
  "Great adventures start at the table. Gather your crew!",
  "The best strategy? Making time to play. ♟️",
  "Cardboard, dice, and good company — the recipe for a perfect evening.",
  "Your next favorite game might already be on your shelf.",
  "No screens needed — just friends, snacks, and a great game. 🍕",
  "Board games: where legends are made and friendships are tested. 😄",
  "Today's a great day to learn a new game!",
  "Roll high, play bold, and have fun. That's the only rule that matters.",
  "Somewhere out there, a meeple believes in you. 🫡",
  "May your dice be ever in your favor.",
  "Shuffle the deck. Set the board. Let the adventure begin!",
];

function MotivationalMessage() {
  const message = useMemo(() => {
    // Rotate daily based on the date
    const dayIndex = Math.floor(Date.now() / 86400000) % MOTIVATIONAL_MESSAGES.length;
    return MOTIVATIONAL_MESSAGES[dayIndex];
  }, []);

  return (
    <p className="text-sm text-muted-foreground italic">{message}</p>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading } = useAuth();
  const { data: library } = useMyLibrary();
  const { data: profile } = useUserProfile();
  const navigate = useNavigate();
  const [randomPickerOpen, setRandomPickerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const displayName = profile?.display_name || (user as any)?.user_metadata?.display_name || user?.email?.split("@")[0] || "Player";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background flex flex-col relative">
      <img src={tavernBg} alt="" className="absolute inset-0 w-full h-full object-cover" loading="eager" />
      <div className="absolute inset-0 bg-background/60" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <AnnouncementBanner />
        <div className="container mx-auto px-4 pt-3">
          <TwoFactorBanner />
        </div>
        <AppHeader />

        <main className="container mx-auto px-4 py-6 max-w-6xl flex-1">
          {/* Greeting + motivational message */}
          <div className="mb-6">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">
              {t('dashboard.welcomeBack', { name: displayName })}
            </h1>
            <MotivationalMessage />
          </div>

          {/* Two-column layout: Feed + Sidebar — tops aligned */}
          <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
            {/* Main feed column */}
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-base font-semibold text-foreground mb-3">
                {t('dashboard.activityFeed', 'Activity Feed')}
              </h2>
              <DashboardActivityFeed />
            </div>

            {/* Right sidebar — stacks below on mobile */}
            <aside className="w-full lg:w-72 xl:w-80 shrink-0">
              <DashboardSidebar />
            </aside>
          </div>
        </main>

        <Footer />
        <MobileBottomTabs />
        <GuidedTour librarySlug={library?.slug} />

        {/* Random Picker Dialog */}
        <Dialog open={randomPickerOpen} onOpenChange={setRandomPickerOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shuffle className="h-5 w-5 text-primary" />
                {t('dashboard.randomPicker')}
              </DialogTitle>
            </DialogHeader>
            {library && <RandomGamePicker libraryId={library.id} librarySlug={library.slug} />}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
