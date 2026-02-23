import { useState } from "react";
import { format } from "date-fns";
import { Vote, PartyPopper, Clock, Users, Share2, Trash2, BarChart3, ChevronDown, ChevronUp, Check, Download, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { type Poll, useClosePoll, useDeletePoll, usePoll, usePollResults, useVote, useRemoveVote } from "@/hooks/usePolls";
import { toast } from "sonner";
import { useTenantUrl } from "@/hooks/useTenantUrl";
import { GameImage } from "@/components/games/GameImage";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { downloadICS, googleCalendarUrl } from "@/lib/calendar";

function getVoterIdentifier(userId?: string): string {
  if (userId) return userId;
  let id = localStorage.getItem("voter_identifier");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("voter_identifier", id);
  }
  return id;
}

interface PollCardProps {
  poll: Poll;
  libraryId: string;
  onViewResults?: (pollId: string) => void;
  canManage?: boolean;
}

export function PollCard({ poll, libraryId, onViewResults, canManage = true }: PollCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [votedOptionIds, setVotedOptionIds] = useState<string[]>([]);
  const closePoll = useClosePoll();
  const deletePoll = useDeletePoll();
  const voteMutation = useVote();
  const removeVoteMutation = useRemoveVote();
  const { data: results } = usePollResults(poll.id);
  const { data: fullPoll, isLoading: optionsLoading } = usePoll(expanded ? poll.id : null);
  const { buildUrl } = useTenantUrl();
  const { user } = useAuth();

  const voterIdentifier = getVoterIdentifier(user?.id);
  const totalVotes = results?.reduce((sum, r) => sum + r.vote_count, 0) || 0;

  const isOpen = poll.status === "open" && (!poll.voting_ends_at || new Date(poll.voting_ends_at) > new Date());
  const showResults = poll.show_results_before_close || poll.status === "closed";

  const handleCopyLink = () => {
    const url = buildUrl(`/poll/${poll.share_token}`);
    navigator.clipboard.writeText(window.location.origin + url);
    toast.success("Poll link copied to clipboard!");
  };

  const handleVote = async (optionId: string) => {
    if (votedOptionIds.includes(optionId)) {
      await removeVoteMutation.mutateAsync({ pollId: poll.id, optionId, voterIdentifier });
      setVotedOptionIds(prev => prev.filter(id => id !== optionId));
    } else if (isOpen && votedOptionIds.length < poll.max_votes_per_user) {
      const voterName = user ? undefined : localStorage.getItem("voter_name") || undefined;
      await voteMutation.mutateAsync({ pollId: poll.id, optionId, voterIdentifier, voterName });
      setVotedOptionIds(prev => [...prev, optionId]);
    }
  };

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    open: "bg-green-500/20 text-green-700 dark:text-green-400",
    closed: "bg-red-500/20 text-red-700 dark:text-red-400",
  };

  const options = fullPoll?.options || [];
  const canVoteMore = isOpen && votedOptionIds.length < poll.max_votes_per_user;

  return (
    <Card className="bg-card/50 hover:bg-card/80 transition-colors overflow-hidden">
      {/* Header row - clickable to expand */}
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Icon + Title + Status */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {poll.poll_type === "game_night" ? (
            <PartyPopper className="h-5 w-5 shrink-0 text-primary" />
          ) : (
            <Vote className="h-5 w-5 shrink-0 text-primary" />
          )}
          <span className="font-semibold text-sm truncate">{poll.title}</span>
          <Badge className={`${statusColors[poll.status]} text-[10px] px-1.5 py-0 shrink-0`}>
            {poll.status}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground shrink-0">
          {poll.poll_type === "game_night" && poll.event_date && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(poll.event_date), "PP")}
            </span>
          )}
          {poll.voting_ends_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Ends {format(new Date(poll.voting_ends_at), "PP")}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Actions - stop propagation so clicks don't toggle expand */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={handleCopyLink}>
            <Share2 className="h-3 w-3 mr-1" />
            Share
          </Button>

          {/* Calendar export for game nights */}
          {poll.poll_type === "game_night" && poll.event_date && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => downloadICS({
                  title: `🎲 ${poll.title}`,
                  description: poll.description || undefined,
                  location: poll.event_location || undefined,
                  startDate: new Date(poll.event_date!),
                  allDay: !poll.event_date!.includes("T"),
                })}
              >
                <Download className="h-3 w-3 mr-1" />
                .ics
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" asChild>
                <a
                  href={googleCalendarUrl({
                    title: `🎲 ${poll.title}`,
                    description: poll.description || undefined,
                    location: poll.event_location || undefined,
                    startDate: new Date(poll.event_date!),
                    allDay: !poll.event_date!.includes("T"),
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Google
                </a>
              </Button>
            </>
          )}

          {onViewResults && (
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onViewResults(poll.id)}>
              <BarChart3 className="h-3 w-3 mr-1" />
              Results
            </Button>
          )}

          {canManage && poll.status === "open" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => closePoll.mutate(poll.id)}
              disabled={closePoll.isPending}
            >
              Close
            </Button>
          )}

          {canManage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Poll</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this poll and all its votes. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletePoll.mutate({ pollId: poll.id, libraryId })}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Expanded options list with voting */}
      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 space-y-2">
          {poll.description && (
            <p className="text-sm text-muted-foreground mb-3">{poll.description}</p>
          )}

          {isOpen && (
            <p className="text-xs text-muted-foreground mb-2">
              Click an option to vote · {poll.max_votes_per_user > 1 ? `Up to ${poll.max_votes_per_user} votes` : "1 vote"} allowed
              {votedOptionIds.length > 0 && ` · ${votedOptionIds.length} used`}
            </p>
          )}

          {optionsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No options added yet.</p>
          ) : (
            <div className="grid gap-2">
              {options.map((option, index) => {
                const result = results?.find((r) => r.option_id === option.id);
                const voteCount = result?.vote_count || 0;
                const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                const isVoted = votedOptionIds.includes(option.id);
                const isVoting = voteMutation.isPending || removeVoteMutation.isPending;

                return (
                  <button
                    key={option.id}
                    onClick={(e) => { e.stopPropagation(); handleVote(option.id); }}
                    disabled={!isOpen || isVoting || (!canVoteMore && !isVoted)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all relative overflow-hidden ${
                      isVoted
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : isOpen && canVoteMore
                        ? "border-border/50 bg-background/50 hover:border-primary/50 cursor-pointer"
                        : "border-border/50 bg-background/50 opacity-75"
                    }`}
                  >
                    {/* Vote percentage background bar */}
                    {showResults && totalVotes > 0 && (
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    )}

                    <span className="text-xs font-bold text-muted-foreground w-5 text-center relative z-10">
                      {index + 1}
                    </span>

                    {option.game?.image_url && (
                      <div className="w-10 h-10 rounded overflow-hidden shrink-0 relative z-10">
                        <GameImage
                          imageUrl={option.game.image_url}
                          alt={option.game?.title || "Game"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <span className="text-sm font-medium flex-1 min-w-0 truncate relative z-10">
                      {option.game?.title || "Unknown game"}
                    </span>

                    {isVoted && (
                      <Check className="h-4 w-4 text-primary shrink-0 relative z-10" />
                    )}

                    {showResults && (
                      <div className="flex items-center gap-2 shrink-0 relative z-10">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {voteCount} vote{voteCount !== 1 ? "s" : ""}
                        </Badge>
                        {totalVotes > 0 && (
                          <span className="text-[10px] text-muted-foreground w-10 text-right">
                            {percentage.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Top results preview - only when collapsed */}
      {!expanded && results && results.length > 0 && showResults && (
        <div className="border-t border-border/50 px-4 py-2.5 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Top Results</span>
          {results.slice(0, 3).map((result, index) => (
            <span key={result.option_id} className="flex items-center gap-1 text-xs">
              <span className="font-medium">{index + 1}.</span>
              <span className="truncate max-w-[120px]">{result.game_title}</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {result.vote_count}
              </Badge>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
