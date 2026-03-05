import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RichTextEditor } from "@/components/community/RichTextEditor";
import { Send, Lock, ImagePlus, X, Loader2 } from "lucide-react";
import { useSubmitMove } from "@/hooks/usePlayByForum";
import { useAuth } from "@/hooks/useAuth";
import type { PbfGame, PbfPlayer } from "@/hooks/usePlayByForum";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/backend/client";
import { toast } from "sonner";

interface PbfSubmitMoveProps {
  game: PbfGame;
  players: PbfPlayer[];
}

export function PbfSubmitMove({ game, players }: PbfSubmitMoveProps) {
  const [moveText, setMoveText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/pbf-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("user-photos")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("user-photos")
        .getPublicUrl(path);

      setImageUrl(urlData.publicUrl);
    } catch (err: any) {
      toast.error("Failed to upload image: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasContent) return;

    submitMove.mutate(
      { pbfGameId: game.id, moveText, imageUrl: imageUrl || undefined },
      {
        onSuccess: () => {
          setMoveText("");
          setImageUrl(null);
        },
      }
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

      {/* Image upload area */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-1" />
          )}
          {uploading ? "Uploading..." : "Attach Board State"}
        </Button>

        {imageUrl && (
          <div className="relative inline-block">
            <img
              src={imageUrl}
              alt="Board state"
              className="h-16 w-16 rounded-md object-cover border"
            />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!hasContent || submitMove.isPending || uploading}>
          <Send className="h-4 w-4 mr-2" />
          {submitMove.isPending ? "Submitting..." : "Submit Move"}
        </Button>
      </div>
    </form>
  );
}
