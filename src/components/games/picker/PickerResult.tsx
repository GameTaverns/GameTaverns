import { Badge } from "@/components/ui/badge";
import { Clock, Users, BookX } from "lucide-react";
import { getDifficultyDisplay } from "@/lib/complexity";
import { motion } from "framer-motion";

interface PickerResultGame {
  id: string;
  title: string;
  image_url: string | null;
  play_time?: string | null;
  min_players?: number | null;
  max_players?: number | null;
  difficulty?: string | null;
  is_unplayed?: boolean;
}

interface PickerResultProps {
  game: PickerResultGame;
  isAnimating?: boolean;
}

export function PickerResult({ game, isAnimating }: PickerResultProps) {
  if (isAnimating) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 border text-center overflow-hidden">
        <motion.div
          key={game.id}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 0.7 }}
          transition={{ duration: 0.06 }}
        >
          {game.image_url && (
            <img src={game.image_url} alt={game.title} className="w-20 h-20 mx-auto rounded-lg object-cover mb-1.5 opacity-60" />
          )}
          <h3 className="font-display text-base text-muted-foreground">{game.title}</h3>
        </motion.div>
      </div>
    );
  }

  const complexity = getDifficultyDisplay(game.difficulty);

  return (
    <motion.div
      key={"result-" + game.id}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="p-4 rounded-lg bg-secondary/10 border border-secondary/30 text-center"
    >
      {game.image_url && (
        <img src={game.image_url} alt={game.title} className="w-28 h-28 mx-auto rounded-lg object-cover mb-2" />
      )}
      <h3 className="font-display text-lg font-bold">{game.title}</h3>
      <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
        {game.play_time && (
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />{game.play_time}
          </Badge>
        )}
        {game.min_players && game.max_players && (
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />{game.min_players}–{game.max_players}
          </Badge>
        )}
        {complexity && (
          <Badge className={`text-xs ${complexity.badgeClass}`}>
            <span className={`h-2 w-2 rounded-full ${complexity.dotClass} mr-1 inline-block`} />
            {complexity.label}
          </Badge>
        )}
        {game.is_unplayed && (
          <Badge variant="secondary" className="text-xs">
            <BookX className="h-3 w-3 mr-1" />Unplayed!
          </Badge>
        )}
      </div>
    </motion.div>
  );
}
