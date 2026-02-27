import { format } from "date-fns";
import { Trophy, Sparkles, Clock, Trash2, Calendar, Users, Puzzle, UserCheck, Clock3 } from "lucide-react";
import { useGameSessions, type GameSession } from "@/hooks/useGameSessions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Link } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { getLibraryUrl } from "@/hooks/useTenantUrl";

interface PlayHistoryProps {
  gameId: string;
}

function PlayerBadge({ player }: { player: GameSession["players"][0] }) {
  const { tenantSlug } = useTenant();

  const profileUrl = (username: string | null) => {
    const path = `/u/${username}`;
    return tenantSlug ? getLibraryUrl(tenantSlug, path) : path;
  };

  const isLinked = player.linked_user_id && player.tag_status === "accepted";
  const isPending = player.linked_user_id && player.tag_status === "pending";

  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
      <div className="flex items-center gap-2">
        {player.color && (
          <span
            className="w-4 h-4 rounded-full border border-border flex-shrink-0"
            style={{ backgroundColor: player.color.toLowerCase() }}
          />
        )}
        {isLinked ? (
          <Avatar className="h-6 w-6">
            <AvatarImage src={player.linked_avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {(player.linked_display_name ?? player.linked_username ?? player.player_name)[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : null}
        <div className="flex items-center gap-1.5">
          {isLinked ? (
            <Link
              to={profileUrl(player.linked_username ?? null)}
              className="font-medium text-sm hover:text-primary transition-colors"
            >
              {player.linked_display_name ?? player.player_name}
            </Link>
          ) : (
            <span className="font-medium text-sm">{player.player_name}</span>
          )}
          {player.is_winner && <Trophy className="h-4 w-4 text-secondary" />}
          {player.is_first_play && <Sparkles className="h-4 w-4 text-primary" />}
          {isLinked && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary/30 text-primary">
              <UserCheck className="h-2.5 w-2.5 mr-0.5" />
              Linked
            </Badge>
          )}
          {isPending && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
              <Clock3 className="h-2.5 w-2.5 mr-0.5" />
              Pending
            </Badge>
          )}
        </div>
      </div>
      {player.score !== null && (
        <span className="text-sm font-mono text-muted-foreground">{player.score} pts</span>
      )}
    </div>
  );
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
    if (a.is_winner !== b.is_winner) return a.is_winner ? -1 : 1;
    if (a.score !== null && b.score !== null) return b.score - a.score;
    return 0;
  });

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
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

      {session.expansions && session.expansions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Puzzle className="h-4 w-4" />
            Expansions Used
          </div>
          <div className="flex flex-wrap gap-2">
            {session.expansions.map((exp) => (
              <div key={exp.id} className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50 text-xs">
                {exp.image_url && (
                  <img src={exp.image_url} alt={exp.title || "Expansion cover"} className="w-5 h-5 rounded object-cover" />
                )}
                <span>{exp.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedPlayers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" />
            Players ({sortedPlayers.length})
          </div>
          <div className="grid gap-1.5">
            {sortedPlayers.map((player) => (
              <PlayerBadge key={player.id} player={player} />
            ))}
          </div>
        </div>
      )}

      {session.notes && (
        <p className="text-sm text-muted-foreground italic border-t pt-3">{session.notes}</p>
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
