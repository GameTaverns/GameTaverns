import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Vote, PartyPopper, Clock, MapPin, Check, Users, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { usePollByToken, usePollResults, useVote, useRemoveVote, useUpdateRSVP, useGameNightRSVPs } from "@/hooks/usePolls";
import { GameImage } from "@/components/games/GameImage";
import { Progress } from "@/components/ui/progress";

interface PollVotingPageProps {
  shareToken: string;
}

function getVoterIdentifier(): string {
  let id = localStorage.getItem("voter_identifier");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("voter_identifier", id);
  }
  return id;
}

export function PollVotingPage({ shareToken }: PollVotingPageProps) {
  const { data: poll, isLoading: pollLoading, error: pollError } = usePollByToken(shareToken);
  const { data: results, isLoading: resultsLoading } = usePollResults(poll?.id || null);
  const { data: rsvps } = useGameNightRSVPs(poll?.poll_type === "game_night" ? poll?.id : null);
  
  const vote = useVote();
  const removeVote = useRemoveVote();
  const updateRSVP = useUpdateRSVP();

  const [voterName, setVoterName] = useState(() => localStorage.getItem("voter_name") || "");
  const [votedOptionIds, setVotedOptionIds] = useState<string[]>([]);
  const [rsvpStatus, setRsvpStatus] = useState<"going" | "maybe" | "not_going" | null>(null);

  const voterIdentifier = getVoterIdentifier();

  // Save voter name
  useEffect(() => {
    if (voterName) {
      localStorage.setItem("voter_name", voterName);
    }
  }, [voterName]);

  // Check existing votes (simplified - would need backend support for proper checking)
  useEffect(() => {
    if (poll && results) {
      // In a real implementation, we'd check which options this voter has voted for
      // For now, we'll track it locally
    }
  }, [poll, results]);

  if (pollLoading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (pollError || !poll) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <Vote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Poll Not Found</h2>
            <p className="text-muted-foreground">
              This poll may have been deleted or the link is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isClosed = poll.status === "closed" || 
    (poll.voting_ends_at && new Date(poll.voting_ends_at) < new Date());

  const showResults = isClosed || poll.show_results_before_close;
  const totalVotes = results?.reduce((sum, r) => sum + r.vote_count, 0) || 0;
  const maxVotes = results?.reduce((max, r) => Math.max(max, r.vote_count), 0) || 0;

  const canVote = poll.status === "open" && 
    (!poll.voting_ends_at || new Date(poll.voting_ends_at) > new Date()) &&
    votedOptionIds.length < poll.max_votes_per_user;

  const handleVote = async (optionId: string) => {
    if (votedOptionIds.includes(optionId)) {
      await removeVote.mutateAsync({ pollId: poll.id, optionId, voterIdentifier });
      setVotedOptionIds(votedOptionIds.filter(id => id !== optionId));
    } else if (canVote) {
      await vote.mutateAsync({ pollId: poll.id, optionId, voterIdentifier, voterName });
      setVotedOptionIds([...votedOptionIds, optionId]);
    }
  };

  const handleRSVP = async (status: "going" | "maybe" | "not_going") => {
    if (!poll) return;
    await updateRSVP.mutateAsync({
      pollId: poll.id,
      guestIdentifier: voterIdentifier,
      guestName: voterName,
      status,
    });
    setRsvpStatus(status);
  };

  const rsvpCounts = {
    going: rsvps?.filter(r => r.status === "going").length || 0,
    maybe: rsvps?.filter(r => r.status === "maybe").length || 0,
    not_going: rsvps?.filter(r => r.status === "not_going").length || 0,
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Poll Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {poll.poll_type === "game_night" ? (
              <PartyPopper className="h-8 w-8 text-primary" />
            ) : (
              <Vote className="h-8 w-8 text-primary" />
            )}
            <div>
              <CardTitle className="text-2xl">{poll.title}</CardTitle>
              {poll.description && (
                <CardDescription className="mt-1">{poll.description}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            {poll.poll_type === "game_night" && poll.event_date && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {format(new Date(poll.event_date), "EEEE, MMMM d 'at' h:mm a")}
              </div>
            )}
            {poll.event_location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {poll.event_location}
              </div>
            )}
            {poll.voting_ends_at && !isClosed && (
              <Badge variant="outline">
                Voting ends {format(new Date(poll.voting_ends_at), "MMM d")}
              </Badge>
            )}
            {isClosed && (
              <Badge variant="secondary">Voting closed</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Voter Name */}
      {!isClosed && (
        <Card>
          <CardContent className="pt-6">
            <Label htmlFor="voter-name">Your Name (optional)</Label>
            <Input
              id="voter-name"
              placeholder="Enter your name"
              value={voterName}
              onChange={(e) => setVoterName(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              This helps the host know who voted. You can vote for up to {poll.max_votes_per_user} game{poll.max_votes_per_user !== 1 ? "s" : ""}.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Voting Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Games</span>
            <Badge variant="outline">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {resultsLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : (
            poll.options?.map((option) => {
              const result = results?.find(r => r.option_id === option.id);
              const voteCount = result?.vote_count || 0;
              const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
              const isVoted = votedOptionIds.includes(option.id);
              const isWinner = isClosed && voteCount === maxVotes && maxVotes > 0;

              return (
                <button
                  key={option.id}
                  onClick={() => !isClosed && handleVote(option.id)}
                  disabled={isClosed || (!canVote && !isVoted)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    isVoted
                      ? "border-primary bg-primary/10"
                      : isWinner
                      ? "border-yellow-500 bg-yellow-500/10"
                      : "border-border hover:border-primary/50"
                  } ${isClosed ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-muted">
                      {(option.game as any)?.image_url ? (
                        <GameImage
                          imageUrl={(option.game as any)?.image_url}
                          alt={(option.game as any)?.title || "Game"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{(option.game as any)?.title}</span>
                        {isWinner && <Trophy className="h-4 w-4 text-yellow-500" />}
                        {isVoted && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      {showResults && (
                        <div className="mt-2 space-y-1">
                          <Progress value={percentage} className="h-2" />
                          <div className="text-xs text-muted-foreground">
                            {voteCount} vote{voteCount !== 1 ? "s" : ""} ({percentage.toFixed(0)}%)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* RSVP for Game Nights */}
      {poll.poll_type === "game_night" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              RSVP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={rsvpStatus || ""}
              onValueChange={(v) => handleRSVP(v as any)}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="going" id="going" />
                <Label htmlFor="going" className="cursor-pointer">
                  Going ({rsvpCounts.going})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="maybe" id="maybe" />
                <Label htmlFor="maybe" className="cursor-pointer">
                  Maybe ({rsvpCounts.maybe})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="not_going" id="not_going" />
                <Label htmlFor="not_going" className="cursor-pointer">
                  Can't make it ({rsvpCounts.not_going})
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
