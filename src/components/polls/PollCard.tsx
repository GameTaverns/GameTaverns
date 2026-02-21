import { format } from "date-fns";
import { Vote, PartyPopper, Clock, Users, Share2, Trash2, BarChart3 } from "lucide-react";
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
    <Card className="bg-card/50 hover:bg-card/80 transition-colors overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
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

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={handleCopyLink}>
            <Share2 className="h-3 w-3 mr-1" />
            Share
          </Button>

          {onViewResults && (
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onViewResults(poll.id)}>
              <BarChart3 className="h-3 w-3 mr-1" />
              Results
            </Button>
          )}

          {poll.status === "open" && (
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

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
...
          </AlertDialog>
        </div>
      </div>

      {/* Top results preview */}
      {results && results.length > 0 && (poll.show_results_before_close || poll.status === "closed") && (
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
