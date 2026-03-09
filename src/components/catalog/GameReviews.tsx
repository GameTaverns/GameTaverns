import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  useGameReviews,
  useMyReview,
  useReviewAggregate,
  useSubmitReview,
  useReviewVote,
  type ReviewFormData,
} from "@/hooks/useGameReviews";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Star, ThumbsUp, ThumbsDown, PenLine, ChevronDown, ChevronUp, Shield, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function StarRating({ value, onChange, size = "md" }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={`${onChange ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
        >
          <Star
            className={`${s} ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        </button>
      ))}
    </div>
  );
}

function RatingBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <span className="text-xs font-medium text-foreground w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function ReviewCard({ review }: { review: any }) {
  const { isAuthenticated } = useAuth();
  const vote = useReviewVote();
  const [expanded, setExpanded] = useState(false);
  const isLong = review.content.length > 300;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={review.user_profile?.avatar_url || undefined} />
            <AvatarFallback>{(review.user_profile?.display_name || "?")[0]}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              {review.user_profile?.username ? (
                <Link to={`/u/${review.user_profile.username}`} className="text-sm font-medium text-foreground hover:text-primary">
                  {review.user_profile.display_name || review.user_profile.username}
                </Link>
              ) : (
                <span className="text-sm font-medium text-foreground">Anonymous</span>
              )}
              {review.reviewer_weight >= 2 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Shield className="h-3 w-3" /> Trusted
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
              {review.play_count_at_review != null && ` • ${review.play_count_at_review} plays`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-foreground">{review.rating_overall}</span>
          <span className="text-muted-foreground text-xs">/10</span>
        </div>
      </div>

      {review.title && (
        <h4 className="font-semibold text-foreground">{review.title}</h4>
      )}

      <div className="text-sm text-muted-foreground leading-relaxed">
        {isLong && !expanded ? (
          <>
            {review.content.slice(0, 300)}...
            <button onClick={() => setExpanded(true)} className="text-primary text-xs ml-1 hover:underline">
              Show more
            </button>
          </>
        ) : (
          review.content
        )}
        {isLong && expanded && (
          <button onClick={() => setExpanded(false)} className="text-primary text-xs ml-1 hover:underline">
            Show less
          </button>
        )}
      </div>

      {review.recommended != null && (
        <Badge variant={review.recommended ? "default" : "secondary"} className="text-xs">
          {review.recommended ? "👍 Recommended" : "👎 Not Recommended"}
        </Badge>
      )}

      {isAuthenticated && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs h-7"
            onClick={() => vote.mutate({ reviewId: review.id, voteType: "helpful" })}
            disabled={vote.isPending}
          >
            <ThumbsUp className="h-3 w-3" /> Helpful ({review.helpful_count})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs h-7"
            onClick={() => vote.mutate({ reviewId: review.id, voteType: "unhelpful" })}
            disabled={vote.isPending}
          >
            <ThumbsDown className="h-3 w-3" /> ({review.unhelpful_count})
          </Button>
        </div>
      )}
    </div>
  );
}

interface GameReviewsProps {
  catalogId: string;
  gameTitle: string;
}

export function GameReviews({ catalogId, gameTitle }: GameReviewsProps) {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const { data: reviews = [], isLoading } = useGameReviews(catalogId);
  const { data: myReview } = useMyReview(catalogId);
  const { data: aggregate } = useReviewAggregate(catalogId);
  const submitReview = useSubmitReview();
  const [showForm, setShowForm] = useState(false);

  // Review form state
  const [ratingOverall, setRatingOverall] = useState(myReview?.rating_overall || 0);
  const [ratingGameplay, setRatingGameplay] = useState(myReview?.rating_gameplay || 0);
  const [ratingComponents, setRatingComponents] = useState(myReview?.rating_components || 0);
  const [ratingReplayability, setRatingReplayability] = useState(myReview?.rating_replayability || 0);
  const [ratingValue, setRatingValue] = useState(myReview?.rating_value || 0);
  const [title, setTitle] = useState(myReview?.title || "");
  const [content, setContent] = useState(myReview?.content || "");
  const [recommended, setRecommended] = useState(myReview?.recommended ?? true);
  const [playCount, setPlayCount] = useState(myReview?.play_count_at_review?.toString() || "");

  const handleSubmit = async () => {
    if (ratingOverall === 0) {
      toast({ title: "Rating required", description: "Please give an overall rating.", variant: "destructive" });
      return;
    }
    if (content.length < 100) {
      toast({ title: "Review too short", description: `Reviews must be at least 100 characters. (Currently ${content.length})`, variant: "destructive" });
      return;
    }

    try {
      await submitReview.mutateAsync({
        catalog_id: catalogId,
        rating_overall: ratingOverall,
        rating_gameplay: ratingGameplay || undefined,
        rating_components: ratingComponents || undefined,
        rating_replayability: ratingReplayability || undefined,
        rating_value: ratingValue || undefined,
        title: title || undefined,
        content,
        recommended,
        play_count_at_review: playCount ? parseInt(playCount) : undefined,
        ownership_status: "owned",
      });
      toast({ title: myReview ? "Review updated" : "Review published!", description: "Thanks for sharing your thoughts." });
      setShowForm(false);
    } catch (err: any) {
      const msg = err?.message || "Something went wrong";
      toast({
        title: "Could not submit review",
        description: msg.includes("own or have previously owned")
          ? "You must have this game in your library to review it."
          : msg,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
          <PenLine className="h-5 w-5" />
          Community Reviews
          {aggregate && (
            <Badge variant="secondary" className="ml-2">{aggregate.count}</Badge>
          )}
        </h2>
        {isAuthenticated && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <PenLine className="h-3.5 w-3.5" />
            {myReview ? "Edit Review" : "Write Review"}
          </Button>
        )}
      </div>

      {/* Aggregate scores */}
      {aggregate && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 mb-3">
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">{aggregate.overall}</div>
                <div className="text-xs text-muted-foreground">{aggregate.count} review{aggregate.count !== 1 ? "s" : ""}</div>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="flex-1 space-y-1.5">
                <RatingBar label="Gameplay" value={aggregate.gameplay} />
                <RatingBar label="Components" value={aggregate.components} />
                <RatingBar label="Replayability" value={aggregate.replayability} />
                <RatingBar label="Value" value={aggregate.value} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ratings are weighted by reviewer activity and experience.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Review form */}
      {showForm && (
        <Card className="mb-6 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{myReview ? "Edit your review" : "Write a review"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1.5">Overall Rating *</Label>
              <StarRating value={ratingOverall} onChange={setRatingOverall} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1">Gameplay</Label>
                <StarRating value={ratingGameplay} onChange={setRatingGameplay} size="sm" />
              </div>
              <div>
                <Label className="text-xs mb-1">Components</Label>
                <StarRating value={ratingComponents} onChange={setRatingComponents} size="sm" />
              </div>
              <div>
                <Label className="text-xs mb-1">Replayability</Label>
                <StarRating value={ratingReplayability} onChange={setRatingReplayability} size="sm" />
              </div>
              <div>
                <Label className="text-xs mb-1">Value</Label>
                <StarRating value={ratingValue} onChange={setRatingValue} size="sm" />
              </div>
            </div>

            <div>
              <Label>Title (optional)</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Sum up your thoughts..." />
            </div>

            <div>
              <Label>Review * (minimum 100 characters)</Label>
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Share your experience with this game..."
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">{content.length}/100 minimum</p>
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-sm">Times played</Label>
              <Input
                type="number"
                min="0"
                className="w-20"
                value={playCount}
                onChange={e => setPlayCount(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={recommended} onCheckedChange={setRecommended} />
              <Label>{recommended ? "I recommend this game" : "I don't recommend this game"}</Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitReview.isPending} className="gap-1.5">
                {submitReview.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {myReview ? "Update Review" : "Publish Review"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="border rounded-lg p-4 animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="h-4 w-32 bg-muted rounded" />
              </div>
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-2/3 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 && !showForm ? (
        <div className="text-center py-8 border rounded-lg">
          <PenLine className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-2">No reviews yet</p>
          {isAuthenticated ? (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              Be the first to review
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Link to="/login" className="text-primary hover:underline">Sign in</Link> to write a review
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
