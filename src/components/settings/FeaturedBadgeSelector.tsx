import { useState } from "react";
import { Award, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAchievements } from "@/hooks/useAchievements";
import { useUpdateUserProfile } from "@/hooks/useLibrary";
import { useMyReferral, REFERRAL_TIERS, FOUNDING_MEMBER_BADGE } from "@/hooks/useReferral";

interface FeaturedBadgeSelectorProps {
  currentBadgeId: string | null;
  currentBadge?: {
    name: string;
    icon: string | null;
    tier: number;
  } | null;
}

const TIER_NAMES: Record<number, string> = {
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Platinum',
};

const TIER_COLORS: Record<number, string> = {
  1: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
  2: 'border-slate-400 bg-slate-50 dark:bg-slate-800/50',
  3: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  4: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
};

export function FeaturedBadgeSelector({ currentBadgeId, currentBadge }: FeaturedBadgeSelectorProps) {
  const { userAchievements, isLoading } = useAchievements();
  const updateProfile = useUpdateUserProfile();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(currentBadgeId);

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        featured_achievement_id: selectedId,
      });
      toast({
        title: selectedId ? "Badge updated" : "Badge removed",
        description: selectedId 
          ? "Your featured badge is now displayed next to your name."
          : "Your featured badge has been removed.",
      });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update badge",
        variant: "destructive",
      });
    }
  };

  const earnedAchievements = userAchievements
    .filter((ua) => ua.achievement)
    .map((ua) => ua.achievement!)
    .sort((a, b) => b.tier - a.tier);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Featured Badge
        </CardTitle>
        <CardDescription>
          Choose an achievement badge to display next to your name
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {currentBadge ? (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${TIER_COLORS[currentBadge.tier]}`}>
              <span className="text-xl">{currentBadge.icon || '🏆'}</span>
              <div>
                <p className="font-medium text-sm">{currentBadge.name}</p>
                <p className="text-xs text-muted-foreground">{TIER_NAMES[currentBadge.tier]}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-muted-foreground/30">
              <span className="text-xl opacity-50">🏆</span>
              <p className="text-sm text-muted-foreground">No badge selected</p>
            </div>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                {currentBadge ? "Change" : "Select Badge"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Select Featured Badge</DialogTitle>
                <DialogDescription>
                  Choose from your earned achievements to display next to your name.
                </DialogDescription>
              </DialogHeader>

              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading achievements...</div>
              ) : earnedAchievements.length === 0 ? (
                <div className="py-8 text-center">
                  <Award className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No achievements earned yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sync your progress on the Achievements page to unlock badges!
                  </p>
                </div>
              ) : (
                <>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      {/* Option to remove badge */}
                      <button
                        onClick={() => setSelectedId(null)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                          selectedId === null 
                            ? 'border-primary bg-primary/5' 
                            : 'border-transparent hover:border-muted-foreground/30'
                        }`}
                      >
                        <span className="text-xl opacity-50">
                          <X className="h-5 w-5" />
                        </span>
                        <div className="text-left">
                          <p className="font-medium text-sm">No Badge</p>
                          <p className="text-xs text-muted-foreground">Don't display a badge</p>
                        </div>
                        {selectedId === null && (
                          <Check className="h-4 w-4 ml-auto text-primary" />
                        )}
                      </button>

                      {earnedAchievements.map((achievement) => (
                        <button
                          key={achievement.id}
                          onClick={() => setSelectedId(achievement.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                            selectedId === achievement.id 
                              ? 'border-primary bg-primary/5' 
                              : `border-transparent hover:${TIER_COLORS[achievement.tier]}`
                          }`}
                        >
                          <span className="text-xl">{achievement.icon || '🏆'}</span>
                          <div className="text-left flex-1">
                            <p className="font-medium text-sm">{achievement.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {TIER_NAMES[achievement.tier]} • {achievement.points} pts
                            </p>
                          </div>
                          {selectedId === achievement.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSave} 
                      disabled={updateProfile.isPending}
                    >
                      {updateProfile.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
