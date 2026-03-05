import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Gamepad2,
  Clock,
  Pause,
  Play,
  Trophy,
  XCircle,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { PbfGame, PbfPlayer } from "@/hooks/usePlayByForum";
import { useUpdatePbfStatus } from "@/hooks/usePlayByForum";
import { useAuth } from "@/hooks/useAuth";

interface PbfGameHeaderProps {
  game: PbfGame;
  players: PbfPlayer[];
}

const statusConfig = {
  active: { label: "Active", color: "bg-green-500/10 text-green-700 border-green-500/30", icon: Play },
  paused: { label: "Paused", color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30", icon: Pause },
  completed: { label: "Completed", color: "bg-blue-500/10 text-blue-700 border-blue-500/30", icon: Trophy },
  abandoned: { label: "Abandoned", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

export function PbfGameHeader({ game, players }: PbfGameHeaderProps) {
  const { user } = useAuth();
  const updateStatus = useUpdatePbfStatus();
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string>("");

  const isCreator = user?.id === game.created_by;
  const currentPlayer = players.find(
    (p) => p.player_order === game.current_player_index && p.status === "active"
  );
  const isMyTurn = currentPlayer?.user_id === user?.id;
  const statusInfo = statusConfig[game.status];
  const StatusIcon = statusInfo.icon;
  const activePlayers = players.filter((p) => p.status === "active");

  const winnerPlayer = game.winner_user_id
    ? players.find((p) => p.user_id === game.winner_user_id)
    : null;

  const handleEndGame = () => {
    updateStatus.mutate(
      {
        pbfGameId: game.id,
        status: "completed",
        winnerUserId: selectedWinner || undefined,
      },
      { onSuccess: () => setShowEndDialog(false) }
    );
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Game info row */}
      <div className="flex items-start gap-4">
        {game.game_image_url && (
          <img
            src={game.game_image_url}
            alt={game.game_title}
            className="w-16 h-16 rounded-md object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Gamepad2 className="h-4 w-4 text-indigo-500" />
            <h3 className="font-semibold">{game.game_title}</h3>
            <Badge variant="outline" className={statusInfo.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              <Users className="h-3 w-3 mr-1" />
              {activePlayers.length} players
            </Badge>
          </div>
          {game.turn_time_limit_hours && game.status === "active" && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              <span>
                {game.turn_time_limit_hours}h per turn · Turn started{" "}
                {formatDistanceToNow(new Date(game.turn_started_at), { addSuffix: true })}
              </span>
            </div>
          )}
          {game.status === "completed" && winnerPlayer && (
            <div className="flex items-center gap-1 text-sm mt-1">
              <Trophy className="h-3 w-3 text-yellow-500" />
              <span className="font-medium">
                Winner: {winnerPlayer.profile?.display_name || winnerPlayer.display_name || "Unknown"}
              </span>
            </div>
          )}
        </div>

        {/* Creator controls */}
        {isCreator && game.status !== "completed" && game.status !== "abandoned" && (
          <div className="flex gap-1">
            {game.status === "active" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateStatus.mutate({ pbfGameId: game.id, status: "paused" })}
                disabled={updateStatus.isPending}
              >
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateStatus.mutate({ pbfGameId: game.id, status: "active" })}
                disabled={updateStatus.isPending}
              >
                <Play className="h-3 w-3 mr-1" />
                Resume
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEndDialog(true)}
              disabled={updateStatus.isPending}
            >
              <Trophy className="h-3 w-3 mr-1" />
              End Game
            </Button>
          </div>
        )}
      </div>

      {/* Players row */}
      <div className="flex items-center gap-3 flex-wrap">
        {players.map((player) => {
          const isCurrent = player.player_order === game.current_player_index && game.status === "active";
          const isWinner = game.winner_user_id === player.user_id && game.status === "completed";
          const initials = (player.profile?.display_name || player.display_name || "?")
            .slice(0, 2)
            .toUpperCase();
          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 px-2 py-1 rounded-md transition-colors ${
                isWinner
                  ? "bg-yellow-500/10 ring-2 ring-yellow-500/40"
                  : isCurrent
                  ? "bg-primary/10 ring-2 ring-primary/40"
                  : player.status !== "active"
                  ? "opacity-50"
                  : ""
              }`}
            >
              <Avatar className="h-7 w-7">
                {player.profile?.avatar_url && (
                  <AvatarImage src={player.profile.avatar_url} />
                )}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">
                {player.profile?.display_name || player.display_name || "Player"}
              </span>
              {isWinner && (
                <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                  🏆 WINNER
                </Badge>
              )}
              {isCurrent && !isWinner && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  {player.user_id === user?.id ? "YOUR TURN" : "CURRENT"}
                </Badge>
              )}
              {player.status === "eliminated" && (
                <Badge variant="outline" className="text-[10px]">OUT</Badge>
              )}
              {player.status === "withdrew" && (
                <Badge variant="outline" className="text-[10px]">LEFT</Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Your turn callout */}
      {isMyTurn && game.status === "active" && (
        <div className="bg-primary/5 border border-primary/20 rounded-md px-4 py-2 text-center">
          <span className="font-semibold text-primary">🎯 It's your turn!</span>
          <span className="text-sm text-muted-foreground ml-2">Submit your move below.</span>
        </div>
      )}

      {/* End Game Dialog with Winner Selection */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Game</DialogTitle>
            <DialogDescription>
              Select a winner (optional). If a game from your library is linked, ELO ratings will be updated.
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedWinner} onValueChange={setSelectedWinner}>
            <SelectTrigger>
              <SelectValue placeholder="Select winner (optional)..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No winner (draw / abandoned)</SelectItem>
              {activePlayers.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.profile?.display_name || p.display_name || "Player"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEndGame} disabled={updateStatus.isPending}>
              <Trophy className="h-4 w-4 mr-2" />
              {updateStatus.isPending ? "Ending..." : "End Game"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
