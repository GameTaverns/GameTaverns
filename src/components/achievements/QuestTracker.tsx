import { QUESTS, getQuestProgress } from "@/lib/quests";
import type { AchievementProgress } from "@/hooks/useAchievements";
import { useQuestCompletions, useClaimQuest } from "@/hooks/useQuestProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Gift, Map } from "lucide-react";

interface QuestTrackerProps {
  progress: AchievementProgress;
}

export function QuestTracker({ progress }: QuestTrackerProps) {
  const { data: completions = [] } = useQuestCompletions();
  const claimQuest = useClaimQuest();
  const completedSlugs = new Set(completions.map((c) => c.quest_slug));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Map className="h-5 w-5 text-amber-500" />
        <h3 className="font-display font-semibold text-lg">Quest Chains</h3>
        <Badge variant="outline" className="ml-auto">
          {completedSlugs.size} / {QUESTS.length} complete
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {QUESTS.map((quest) => {
          const isCompleted = completedSlugs.has(quest.slug);
          const qp = getQuestProgress(quest, progress);
          const pct = (qp.completedSteps / qp.totalSteps) * 100;

          return (
            <Card
              key={quest.slug}
              className={`transition-all ${isCompleted ? "border-primary/30 bg-primary/5" : "bg-card"}`}
            >
              <CardContent className="py-4 px-4 space-y-3">
                {/* Quest header */}
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{quest.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-semibold ${quest.color}`}>{quest.name}</h4>
                      {isCompleted && (
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{quest.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Gift className="h-3 w-3" />
                      +{quest.bonusPoints} pts
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <Progress value={pct} className="h-2" />

                {/* Steps */}
                <div className="space-y-2">
                  {qp.stepStatuses.map(({ step, completed, current }) => (
                    <div key={step.id} className="flex items-center gap-2 text-sm">
                      {completed ? (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className={`flex-1 ${completed ? "text-foreground" : "text-muted-foreground"}`}>
                        <span className="mr-1.5">{step.icon}</span>
                        {step.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.min(current, step.requirementValue)} / {step.requirementValue}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Claim button */}
                {qp.isComplete && !isCompleted && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => claimQuest.mutate({ quest, progress })}
                    disabled={claimQuest.isPending}
                  >
                    <Gift className="h-4 w-4 mr-2" />
                    Claim Reward (+{quest.bonusPoints} pts)
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
