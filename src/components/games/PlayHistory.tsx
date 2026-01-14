import { format } from "date-fns";
import { Trophy, Sparkles, Clock, Trash2, Calendar, Users } from "lucide-react";
import { useGameSessions, type GameSession } from "@/hooks/useGameSessions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useAuth } from "@/hooks/useAuth";

interface PlayHistoryProps {
  gameId: string;
}

function SessionCard({
  session,
  isAdmin,
  onDelete,
}: {
  session: GameSession;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  const sortedPlayers = [...session.players].sort((a, b) => {
    // Winners first, then by score
    if (a.is_winner !== b.is_winner) return a.is_winner ? -1 : 1;
    if (a.score !== null && b.score !== null) return b.score - a.score;
    return 0;
  });

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(new Date(session.played_at), "PPp")}
          </div>
          {session.duration_minutes && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {session.duration_minutes} minutes
            </div>
          )}
        </div>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this play session and all player data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Players */}
      {sortedPlayers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" />
            Players ({sortedPlayers.length})
          </div>
          <div className="grid gap-2">
            {sortedPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{player.player_name}</span>
                  {player.is_winner && (
                    <Trophy className="h-4 w-4 text-yellow-500" />
                  )}
                  {player.is_first_play && (
                    <Sparkles className="h-4 w-4 text-blue-500" />
                  )}
                </div>
                {player.score !== null && (
                  <span className="text-sm font-mono text-muted-foreground">
                    {player.score} pts
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {session.notes && (
        <p className="text-sm text-muted-foreground italic border-t pt-3">
          {session.notes}
        </p>
      )}
    </div>
  );
}

export function PlayHistory({ gameId }: PlayHistoryProps) {
  const { sessions, isLoading, deleteSession } = useGameSessions(gameId);
  const { isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No play sessions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {sessions.length} play{sessions.length !== 1 ? "s" : ""} recorded
      </div>
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          isAdmin={isAdmin}
          onDelete={() => deleteSession.mutate(session.id)}
        />
      ))}
    </div>
  );
}
