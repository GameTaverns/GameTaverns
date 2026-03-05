import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RichTextEditor } from "@/components/community/RichTextEditor";
import { Send, Lock } from "lucide-react";
import { useSubmitMove } from "@/hooks/usePlayByForum";
import { useAuth } from "@/hooks/useAuth";
import type { PbfGame, PbfPlayer } from "@/hooks/usePlayByForum";
import { Link } from "react-router-dom";

interface PbfSubmitMoveProps {
  game: PbfGame;
  players: PbfPlayer[];
}

export function PbfSubmitMove({ game, players }: PbfSubmitMoveProps) {
  const [moveText, setMoveText] = useState("");
  const submitMove = useSubmitMove();
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-4 text-center">
          <p className="text-muted-foreground mb-2">Sign in to participate</p>
          <Link to="/login">
            <Button variant="outline">Sign In</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const currentPlayer = players.find(
    (p) => p.player_order === game.current_player_index && p.status === "active"
  );
  const isMyTurn = currentPlayer?.user_id === user?.id;
  const isPlayer = players.some((p) => p.user_id === user?.id && p.status === "active");

  if (game.status !== "active") {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-4 text-center">
          <Lock className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            This game is {game.status}. No more moves can be submitted.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isPlayer) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-4 text-center">
          <p className="text-muted-foreground">You are a spectator in this game.</p>
        </CardContent>
      </Card>
    );
  }

  if (!isMyTurn) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-4 text-center">
          <p className="text-muted-foreground">
            Waiting for <strong>{currentPlayer?.profile?.display_name || "another player"}</strong> to make their move...
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasContent = moveText.replace(/<[^>]*>/g, "").trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasContent) return;

    submitMove.mutate(
      { pbfGameId: game.id, moveText },
      { onSuccess: () => setMoveText("") }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">Your Move</h3>
      <RichTextEditor
        content={moveText}
        onChange={setMoveText}
        placeholder="Describe your move, action, or decision..."
        minHeight="100px"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={!hasContent || submitMove.isPending}>
          <Send className="h-4 w-4 mr-2" />
          {submitMove.isPending ? "Submitting..." : "Submit Move"}
        </Button>
      </div>
    </form>
  );
}
