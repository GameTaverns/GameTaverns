import { useGTScore, getGradeColor, getScoreLabel, type GTScore, type GTScoreSegment } from "@/hooks/useGTScore";
import { cn } from "@/lib/utils";
import { ThumbsUp, BarChart3, ShieldCheck, ShieldAlert, Shield, Crown, Gamepad2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GTScoreBadgeProps {
  catalogId: string | undefined;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

function ConfidenceIcon({ confidence, className }: { confidence: GTScore["confidence"]; className?: string }) {
  switch (confidence) {
    case "high":
      return <ShieldCheck className={cn("text-green-500", className)} />;
    case "medium":
      return <Shield className={cn("text-amber-500", className)} />;
    case "low":
      return <ShieldAlert className={cn("text-muted-foreground", className)} />;
  }
}

function DimensionBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-foreground w-6 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function SegmentScore({ segment, label, icon: Icon }: { segment: GTScoreSegment; label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "px-1.5 py-0.5 rounded text-[10px] font-bold border",
          getGradeColor(segment.grade)
        )}>
          {segment.grade}
        </span>
        <span className="text-xs font-semibold text-foreground">{segment.score.toFixed(1)}</span>
        <span className="text-[10px] text-muted-foreground">({segment.reviewCount})</span>
      </div>
    </div>
  );
}

export function GTScoreBadge({
  catalogId,
  size = "md",
  showLabel = true,
  className,
}: GTScoreBadgeProps) {
  const { data: gtScore } = useGTScore(catalogId);

  if (!catalogId || !gtScore) return null;

  const sizeClasses = {
    sm: "text-xs gap-1",
    md: "text-sm gap-1.5",
    lg: "text-base gap-2",
  };

  const gradeSize = {
    sm: "text-xs w-5 h-5",
    md: "text-sm w-6 h-6",
    lg: "text-lg w-8 h-8",
  };

  const iconSize = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-3.5 w-3.5",
  };

  const badge = (
    <span
      className={cn(
        "inline-flex items-center",
        sizeClasses[size],
        className,
      )}
    >
      {/* Grade badge */}
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md border font-bold",
          gradeSize[size],
          getGradeColor(gtScore.grade),
        )}
      >
        {gtScore.grade}
      </span>
      {/* Score */}
      <span className="font-semibold text-foreground">{gtScore.score.toFixed(1)}</span>
      {showLabel && (
        <span className="text-muted-foreground font-normal">
          ({gtScore.reviewCount})
        </span>
      )}
      <ConfidenceIcon confidence={gtScore.confidence} className={iconSize[size]} />
    </span>
  );

  const showPlayerScore = gtScore.playerScore && gtScore.playerScore.reviewCount >= 3;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="w-72 p-3" side="bottom">
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-foreground">GT Score</span>
              <span className="text-xs text-muted-foreground ml-1.5">{getScoreLabel(gtScore.score)}</span>
            </div>
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-bold border",
              getGradeColor(gtScore.grade)
            )}>
              {gtScore.grade} · {gtScore.score.toFixed(1)}
            </span>
          </div>

          {/* Owner / Player Score Segments */}
          {(gtScore.ownerScore || showPlayerScore) && (
            <div className="space-y-1.5 p-2 rounded-md bg-muted/30 border">
              {gtScore.ownerScore && (
                <SegmentScore segment={gtScore.ownerScore} label="Owner Score" icon={Crown} />
              )}
              {showPlayerScore && (
                <SegmentScore segment={gtScore.playerScore!} label="Player Score" icon={Gamepad2} />
              )}
              <p className="text-[9px] text-muted-foreground/70 pt-0.5">
                Owner reviews carry more weight in the combined score
              </p>
            </div>
          )}

          {/* Dimensions */}
          <div className="space-y-1">
            <DimensionBar label="Overall" value={gtScore.dimensions.overall} />
            {gtScore.dimensions.gameplay != null && (
              <DimensionBar label="Gameplay" value={gtScore.dimensions.gameplay} />
            )}
            {gtScore.dimensions.components != null && (
              <DimensionBar label="Components" value={gtScore.dimensions.components} />
            )}
            {gtScore.dimensions.replayability != null && (
              <DimensionBar label="Replayability" value={gtScore.dimensions.replayability} />
            )}
            {gtScore.dimensions.value != null && (
              <DimensionBar label="Value" value={gtScore.dimensions.value} />
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              {gtScore.reviewCount} review{gtScore.reviewCount !== 1 ? "s" : ""}
            </span>
            {gtScore.recommendRate != null && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {Math.round(gtScore.recommendRate * 100)}% recommend
              </span>
            )}
          </div>

          <p className="text-[9px] text-muted-foreground/70 italic">
            GT Score is algorithmically computed from weighted community reviews. Play count, ownership, and review depth affect scoring weight.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}