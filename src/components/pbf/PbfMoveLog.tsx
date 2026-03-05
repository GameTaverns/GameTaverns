import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichTextContent } from "@/components/community/RichTextEditor";
import { formatDistanceToNow } from "date-fns";
import { ListOrdered } from "lucide-react";
import type { PbfMove } from "@/hooks/usePlayByForum";

interface PbfMoveLogProps {
  moves: PbfMove[];
}

export function PbfMoveLog({ moves }: PbfMoveLogProps) {
  if (moves.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-6 text-center">
          <ListOrdered className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No moves yet. The game is waiting for the first move!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
        <ListOrdered className="h-4 w-4" />
        Move Log ({moves.length})
      </h3>
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-3">
          {moves.map((move) => {
            const initials = (move.player?.display_name || "?")
              .slice(0, 2)
              .toUpperCase();
            return (
              <div
                key={move.id}
                className="flex gap-3 p-3 rounded-md border bg-card"
              >
                <div className="flex flex-col items-center gap-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono px-1.5"
                  >
                    #{move.move_number}
                  </Badge>
                  <Avatar className="h-8 w-8">
                    {move.player?.avatar_url && (
                      <AvatarImage src={move.player.avatar_url} />
                    )}
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {move.player?.display_name || "Player"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(move.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <RichTextContent html={move.move_text} />
                  {move.image_url && (
                    <img
                      src={move.image_url}
                      alt={`Move #${move.move_number}`}
                      className="mt-2 max-w-sm rounded-md border"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
