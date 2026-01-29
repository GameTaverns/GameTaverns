import { Trophy, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePoll, usePollResults, useGameNightRSVPs } from "@/hooks/usePolls";
import { GameImage } from "@/components/games/GameImage";

interface PollResultsDialogProps {
  pollId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PollResultsDialog({ pollId, open, onOpenChange }: PollResultsDialogProps) {
  const { data: poll, isLoading: pollLoading } = usePoll(pollId);
  const { data: results, isLoading: resultsLoading } = usePollResults(pollId);
  const { data: rsvps } = useGameNightRSVPs(poll?.poll_type === "game_night" ? pollId : null);

  const totalVotes = results?.reduce((sum, r) => sum + r.vote_count, 0) || 0;
  const maxVotes = results?.reduce((max, r) => Math.max(max, r.vote_count), 0) || 0;

  const rsvpCounts = {
    going: rsvps?.filter(r => r.status === "going").length || 0,
    maybe: rsvps?.filter(r => r.status === "maybe").length || 0,
    not_going: rsvps?.filter(r => r.status === "not_going").length || 0,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{poll?.title || "Poll Results"}</DialogTitle>
          <DialogDescription>
            {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {pollLoading || resultsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Results */}
            <div className="space-y-3">
              {results?.map((result, index) => {
                const percentage = totalVotes > 0 ? (result.vote_count / totalVotes) * 100 : 0;
                const isWinner = result.vote_count === maxVotes && maxVotes > 0;

                return (
                  <div
                    key={result.option_id}
                    className={`p-3 rounded-lg border ${
                      isWinner ? "border-yellow-500 bg-yellow-500/10" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        {index + 1}
                      </span>
                      <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-muted">
                        {result.image_url ? (
                          <GameImage
                            imageUrl={result.image_url}
                            alt={result.game_title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{result.game_title}</span>
                          {isWinner && <Trophy className="h-4 w-4 text-yellow-500" />}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {result.vote_count}
                      </Badge>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {percentage.toFixed(1)}%
                    </p>
                  </div>
                );
              })}
            </div>

            {/* RSVP Summary for Game Nights */}
            {poll?.poll_type === "game_night" && rsvps && rsvps.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4" />
                  RSVPs
                </h4>
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-green-600 font-medium">{rsvpCounts.going}</span>
                    <span className="text-muted-foreground"> going</span>
                  </div>
                  <div>
                    <span className="text-yellow-600 font-medium">{rsvpCounts.maybe}</span>
                    <span className="text-muted-foreground"> maybe</span>
                  </div>
                  <div>
                    <span className="text-red-600 font-medium">{rsvpCounts.not_going}</span>
                    <span className="text-muted-foreground"> can't make it</span>
                  </div>
                </div>

                {/* List of attendees */}
                <div className="mt-3 space-y-1">
                  {rsvps.filter(r => r.guest_name).map(rsvp => (
                    <div key={rsvp.id} className="text-sm flex items-center justify-between">
                      <span>{rsvp.guest_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {rsvp.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
