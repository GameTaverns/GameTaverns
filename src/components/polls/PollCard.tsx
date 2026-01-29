import { format } from "date-fns";
import { Vote, PartyPopper, Clock, Users, Share2, Trash2, BarChart3 } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { type Poll, useClosePoll, useDeletePoll, usePollResults } from "@/hooks/usePolls";
import { toast } from "sonner";
import { useTenantUrl } from "@/hooks/useTenantUrl";

interface PollCardProps {
  poll: Poll;
  libraryId: string;
  onViewResults?: (pollId: string) => void;
}

export function PollCard({ poll, libraryId, onViewResults }: PollCardProps) {
  const closePoll = useClosePoll();
  const deletePoll = useDeletePoll();
  const { data: results } = usePollResults(poll.id);
  const { buildUrl } = useTenantUrl();

  const totalVotes = results?.reduce((sum, r) => sum + r.vote_count, 0) || 0;

  const handleCopyLink = () => {
    const url = buildUrl(`/poll/${poll.share_token}`);
    navigator.clipboard.writeText(window.location.origin + url);
    toast.success("Poll link copied to clipboard!");
  };

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    open: "bg-green-500/20 text-green-700 dark:text-green-400",
    closed: "bg-red-500/20 text-red-700 dark:text-red-400",
  };

  return (
    <Card className="bg-card/50 hover:bg-card/80 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            {poll.poll_type === "game_night" ? (
              <PartyPopper className="h-5 w-5 text-primary" />
            ) : (
              <Vote className="h-5 w-5 text-primary" />
            )}
            <CardTitle className="text-lg">{poll.title}</CardTitle>
          </div>
          <Badge className={statusColors[poll.status]}>
            {poll.status}
          </Badge>
        </div>
        {poll.description && (
          <p className="text-sm text-muted-foreground mt-2">{poll.description}</p>
        )}
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {poll.poll_type === "game_night" && poll.event_date && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {format(new Date(poll.event_date), "PPp")}
            </div>
          )}
          {poll.voting_ends_at && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Voting ends {format(new Date(poll.voting_ends_at), "PPp")}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Top results preview */}
        {results && results.length > 0 && (poll.show_results_before_close || poll.status === "closed") && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Top Results
            </p>
            {results.slice(0, 3).map((result, index) => (
              <div key={result.option_id} className="flex items-center gap-2">
                <span className="text-sm font-medium w-5">{index + 1}.</span>
                <span className="text-sm truncate flex-1">{result.game_title}</span>
                <Badge variant="outline" className="text-xs">
                  {result.vote_count}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleCopyLink}>
          <Share2 className="h-4 w-4 mr-1.5" />
          Share
        </Button>

        {onViewResults && (
          <Button variant="outline" size="sm" onClick={() => onViewResults(poll.id)}>
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Results
          </Button>
        )}

        {poll.status === "open" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => closePoll.mutate(poll.id)}
            disabled={closePoll.isPending}
          >
            Close Poll
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this poll?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the poll and all votes. This action cannot be undone.
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
      </CardFooter>
    </Card>
  );
}
