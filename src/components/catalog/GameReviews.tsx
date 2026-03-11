import { useState, useEffect } from "react";
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
import {
  useRatingTags,
  useReviewTags,
  useReviewPlayerCountRatings,
  useSaveReviewExtras,
} from "@/hooks/useRatingTags";
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
import { Star, ThumbsUp, ThumbsDown, PenLine, Shield, Loader2, Users, Target, Ban, GitCompare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ReviewTagSelector } from "./ReviewTagSelector";
import { PlayerCountRatingInput } from "./PlayerCountRatingInput";
import { ReviewInsights } from "./ReviewInsights";
import { ReviewUpdatePromptBanner } from "./ReviewUpdatePromptBanner";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { cn } from "@/lib/utils";

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
  const { data: allTags = [] } = useRatingTags();
  const { data: reviewTagLinks = [] } = useReviewTags(review.id);
  const { data: pcRatings = [] } = useReviewPlayerCountRatings(review.id);
  const isLong = review.content.length > 300;

  const tagMap = Object.fromEntries(allTags.map(t => [t.id, t]));
  const reviewTags = reviewTagLinks.map(rt => tagMap[rt.tag_id]).filter(Boolean);

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

      {/* Guided prompts */}
      {(review.best_for || review.skip_if || review.best_player_count || review.compared_to) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {review.best_for && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-green-500/5 border border-green-500/20">
              <Target className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase text-green-600 dark:text-green-400">Best for</p>
                <p className="text-xs text-foreground">{review.best_for}</p>
              </div>
            </div>
          )}
          {review.skip_if && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-red-500/5 border border-red-500/20">
              <Ban className="h-3.5 w-3.5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase text-red-600 dark:text-red-400">Skip if</p>
                <p className="text-xs text-foreground">{review.skip_if}</p>
              </div>
            </div>
          )}
          {review.best_player_count && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
              <Users className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase text-primary">Shines at</p>
                <p className="text-xs text-foreground">{review.best_player_count}</p>
              </div>
            </div>
          )}
          {review.compared_to && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 border">
              <GitCompare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Compare to</p>
                <p className="text-xs text-foreground">{review.compared_to}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {reviewTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {reviewTags.map(tag => (
            <Badge
              key={tag.id}
              variant="outline"
              className={cn(
                "text-[10px] gap-0.5",
                tag.is_positive === true && "border-green-500/30 bg-green-500/5",
                tag.is_positive === false && "border-red-500/30 bg-red-500/5",
              )}
            >
              {tag.icon && <span>{tag.icon}</span>}
              {tag.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Player count ratings */}
      {pcRatings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pcRatings.sort((a, b) => a.player_count - b.player_count).map(pc => (
            <span key={pc.player_count} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted/50 border">
              <Users className="h-3 w-3 text-muted-foreground" />
              {pc.player_count}P:
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {pc.rating}/10
            </span>
          ))}
        </div>
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
  minPlayers?: number;
  maxPlayers?: number;
}

export function GameReviews({ catalogId, gameTitle, minPlayers, maxPlayers }: GameReviewsProps) {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const { data: reviews = [], isLoading } = useGameReviews(catalogId);
  const { data: myReview } = useMyReview(catalogId);
  const { data: aggregate } = useReviewAggregate(catalogId);
  const submitReview = useSubmitReview();
  const saveExtras = useSaveReviewExtras();
  const { data: myReviewTags = [] } = useReviewTags(myReview?.id);
  const { data: myPCRatings = [] } = useReviewPlayerCountRatings(myReview?.id);
  const [showForm, setShowForm] = useState(false);

  // Session storage key for draft persistence
  const draftKey = `review-draft-${catalogId}`;

  // Helper to load draft from sessionStorage
  const loadDraft = () => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const savedDraft = loadDraft();

  // Review form state — initialize from draft if available
  const [ratingOverall, setRatingOverall] = useState(savedDraft?.ratingOverall ?? 0);
  const [ratingGameplay, setRatingGameplay] = useState(savedDraft?.ratingGameplay ?? 0);
  const [ratingComponents, setRatingComponents] = useState(savedDraft?.ratingComponents ?? 0);
  const [ratingReplayability, setRatingReplayability] = useState(savedDraft?.ratingReplayability ?? 0);
  const [ratingValue, setRatingValue] = useState(savedDraft?.ratingValue ?? 0);
  const [title, setTitle] = useState(savedDraft?.title ?? "");
  const [content, setContent] = useState(savedDraft?.content ?? "");
  const [recommended, setRecommended] = useState(savedDraft?.recommended ?? true);
  const [ownershipStatus, setOwnershipStatus] = useState<"owned" | "previously_owned" | "played_only">(savedDraft?.ownershipStatus ?? "owned");
  const [playCount, setPlayCount] = useState(savedDraft?.playCount ?? "");
  const [bestFor, setBestFor] = useState(savedDraft?.bestFor ?? "");
  const [skipIf, setSkipIf] = useState(savedDraft?.skipIf ?? "");
  const [bestPlayerCount, setBestPlayerCount] = useState(savedDraft?.bestPlayerCount ?? "");
  const [comparedTo, setComparedTo] = useState(savedDraft?.comparedTo ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(savedDraft?.selectedTagIds ?? []);
  const [playerCountRatings, setPlayerCountRatings] = useState<{ player_count: number; rating: number }[]>(savedDraft?.playerCountRatings ?? []);

  // Auto-save draft to sessionStorage on changes
  useEffect(() => {
    const draft = {
      ratingOverall, ratingGameplay, ratingComponents, ratingReplayability, ratingValue,
      title, content, recommended, ownershipStatus, playCount, bestFor, skipIf, bestPlayerCount, comparedTo,
      selectedTagIds, playerCountRatings,
    };
    // Only persist if there's meaningful input
    const hasInput = ratingOverall > 0 || content.length > 0 || title.length > 0 || selectedTagIds.length > 0;
    if (hasInput) {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    }
  }, [ratingOverall, ratingGameplay, ratingComponents, ratingReplayability, ratingValue,
      title, content, recommended, ownershipStatus, playCount, bestFor, skipIf, bestPlayerCount, comparedTo,
      selectedTagIds, playerCountRatings, draftKey]);

  // Clear draft helper
  const clearDraft = () => sessionStorage.removeItem(draftKey);

  // Auto-open form if there's a saved draft
  useEffect(() => {
    if (savedDraft && (savedDraft.ratingOverall > 0 || savedDraft.content?.length > 0)) {
      setShowForm(true);
    }
  }, []);

  // Populate form when editing existing review (only if no draft exists)
  useEffect(() => {
    if (myReview && showForm && !savedDraft) {
      setRatingOverall(myReview.rating_overall || 0);
      setRatingGameplay(myReview.rating_gameplay || 0);
      setRatingComponents(myReview.rating_components || 0);
      setRatingReplayability(myReview.rating_replayability || 0);
      setRatingValue(myReview.rating_value || 0);
      setTitle(myReview.title || "");
      setContent(myReview.content || "");
      setRecommended(myReview.recommended ?? true);
      setPlayCount(myReview.play_count_at_review?.toString() || "");
      setBestFor(myReview.best_for || "");
      setSkipIf(myReview.skip_if || "");
      setBestPlayerCount(myReview.best_player_count || "");
      setComparedTo(myReview.compared_to || "");
      setSelectedTagIds(myReviewTags.map(rt => rt.tag_id));
      setPlayerCountRatings(myPCRatings.map(pc => ({ player_count: pc.player_count, rating: pc.rating })));
    }
  }, [myReview, showForm, myReviewTags, myPCRatings]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

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
        best_for: bestFor || undefined,
        skip_if: skipIf || undefined,
        best_player_count: bestPlayerCount || undefined,
        compared_to: comparedTo || undefined,
      });

      // Now get the review ID to save extras
      const { data: savedReview } = await (await import("@/integrations/backend/client")).supabase
        .from("game_reviews")
        .select("id")
        .eq("catalog_id", catalogId)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (savedReview) {
        await saveExtras.mutateAsync({
          reviewId: savedReview.id,
          catalogId,
          tagIds: selectedTagIds,
          playerCountRatings,
        });
      }

      clearDraft();
      toast({ title: myReview ? "Review updated" : "Review published!", description: "Thanks for sharing your experience." });
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
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground">
                Ratings are weighted by reviewer activity and experience.
              </p>
              <InfoPopover
                title="How Review Weight Works"
                description="Your review weight is calculated based on several factors that establish credibility:"
                tips={[
                  "Number of plays logged — more plays = higher weight",
                  "Collection size contributes to weight",
                  "Account age (6+ months and 1+ year bonuses)",
                  "Owner reviews carry 20% more weight than player reviews",
                  "Detailed reviews (tags, player counts, prompts) boost score accuracy",
                ]}
                iconSize={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Update Prompt */}
      <ReviewUpdatePromptBanner
        catalogId={catalogId}
        onUpdateReview={() => setShowForm(true)}
      />

      {/* Review Insights (tags + player count aggregation) */}
      <ReviewInsights catalogId={catalogId} />

      {/* Review form */}
      {showForm && (
        <Card className="mb-6 border-primary/30 mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{myReview ? "Edit your review" : `Review ${gameTitle}`}</CardTitle>
            <p className="text-xs text-muted-foreground">Help others understand if this game is right for them.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Overall Rating */}
            <div>
              <Label className="mb-1.5">Overall Rating *</Label>
              <StarRating value={ratingOverall} onChange={setRatingOverall} />
            </div>

            {/* Sub-ratings */}
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

            <Separator />

            {/* Tags */}
            <ReviewTagSelector selectedTagIds={selectedTagIds} onToggle={toggleTag} />

            <Separator />

            {/* Player Count Ratings */}
            <PlayerCountRatingInput
              value={playerCountRatings}
              onChange={setPlayerCountRatings}
              minPlayers={minPlayers}
              maxPlayers={maxPlayers}
            />

            <Separator />

            {/* Guided prompts */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Help others decide (optional but encouraged)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    <Label className="text-xs">Best for...</Label>
                  </div>
                  <Input
                    value={bestFor}
                    onChange={e => setBestFor(e.target.value)}
                    placeholder="e.g. Couples who want a strategic 2p experience"
                    maxLength={200}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Ban className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    <Label className="text-xs">Skip if you...</Label>
                  </div>
                  <Input
                    value={skipIf}
                    onChange={e => setSkipIf(e.target.value)}
                    placeholder="e.g. Dislike long setup times or heavy luck"
                    maxLength={200}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <Label className="text-xs">Shines at...</Label>
                  </div>
                  <Input
                    value={bestPlayerCount}
                    onChange={e => setBestPlayerCount(e.target.value)}
                    placeholder="e.g. 3-4 players with the advanced variant"
                    maxLength={200}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <GitCompare className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs">Compare to...</Label>
                  </div>
                  <Input
                    value={comparedTo}
                    onChange={e => setComparedTo(e.target.value)}
                    placeholder="e.g. Like Wingspan but with more player interaction"
                    maxLength={200}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Title + Content */}
            <div>
              <Label>Title (optional)</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Sum up your thoughts..." />
            </div>

            <div>
              <Label>Your Review * (minimum 100 characters)</Label>
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="What made this game click (or not) for you? Why would someone love or hate it?"
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">{content.length}/100 minimum</p>
            </div>

            {/* Play count + recommend */}
            <div className="flex items-center gap-6">
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
                <Label className="text-sm">{recommended ? "I recommend this" : "I don't recommend this"}</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={submitReview.isPending || saveExtras.isPending} className="gap-1.5">
                {(submitReview.isPending || saveExtras.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                {myReview ? "Update Review" : "Publish Review"}
              </Button>
              <Button variant="outline" onClick={() => { clearDraft(); setShowForm(false); }}>Cancel</Button>
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
        <div className="text-center py-8 border rounded-lg mt-4">
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
        <div className="space-y-3 mt-4">
          {reviews.map(review => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
