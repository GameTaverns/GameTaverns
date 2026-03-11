import { useState } from "react";
import { useReviewUpdatePrompt, useDismissReviewPrompt } from "@/hooks/useReviewUpdatePrompt";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";

interface ReviewUpdatePromptBannerProps {
  catalogId: string;
  currentPlayCount?: number;
  onUpdateReview: () => void;
}

export function ReviewUpdatePromptBanner({
  catalogId,
  currentPlayCount,
  onUpdateReview,
}: ReviewUpdatePromptBannerProps) {
  const { data: prompt } = useReviewUpdatePrompt(catalogId, currentPlayCount);
  const dismissPrompt = useDismissReviewPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!prompt?.shouldPrompt || dismissed) return null;

  const handleDismiss = () => {
    if (prompt.reviewId) {
      dismissPrompt.mutate({
        reviewId: prompt.reviewId,
        currentPlayCount: prompt.currentPlayCount,
      });
    }
    setDismissed(true);
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <RefreshCw className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {prompt.reason === "play_milestone"
                ? `You've played this ${prompt.currentPlayCount} times since your last review!`
                : "Your feelings may have changed"}
            </p>
            <p className="text-xs text-muted-foreground">
              Would you like to update your score? More plays means your review carries more weight.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={onUpdateReview}>
            Update Review
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleDismiss}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}