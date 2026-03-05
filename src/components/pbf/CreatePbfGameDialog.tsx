import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/community/RichTextEditor";
import { useCreatePbfGame } from "@/hooks/usePlayByForum";
import { Gamepad2 } from "lucide-react";

interface CreatePbfGameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
}

export function CreatePbfGameDialog({
  open,
  onOpenChange,
  categoryId,
  categoryName,
}: CreatePbfGameDialogProps) {
  const [gameTitle, setGameTitle] = useState("");
  const [description, setDescription] = useState("");
  const [turnLimit, setTurnLimit] = useState<string>("24");
  const createGame = useCreatePbfGame();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameTitle.trim()) return;

    createGame.mutate(
      {
        categoryId,
        gameTitle: gameTitle.trim(),
        description: description || undefined,
        playerUserIds: [], // Creator is auto-added; others join via thread
        turnTimeLimitHours: turnLimit ? parseInt(turnLimit) : undefined,
      },
      {
        onSuccess: () => {
          setGameTitle("");
          setDescription("");
          setTurnLimit("24");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-indigo-500" />
              New Play-by-Forum Game
            </DialogTitle>
            <DialogDescription>
              Start an async game in {categoryName}. Other players can join from the thread.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="gameTitle">Game Title</Label>
              <Input
                id="gameTitle"
                placeholder="e.g., Diplomacy, Azul, Codenames..."
                value={gameTitle}
                onChange={(e) => setGameTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Turn Time Limit</Label>
              <Select value={turnLimit} onValueChange={setTurnLimit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">48 hours</SelectItem>
                  <SelectItem value="72">72 hours (3 days)</SelectItem>
                  <SelectItem value="">No limit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description / Rules</Label>
              <RichTextEditor
                content={description}
                onChange={setDescription}
                placeholder="Explain how this game will work, any house rules, etc..."
                minHeight="120px"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!gameTitle.trim() || createGame.isPending}
            >
              {createGame.isPending ? "Creating..." : "Start Game"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
