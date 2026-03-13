import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibraries } from "@/hooks/useLibrary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Dices, Users, Clock, Weight, BookX, Filter, Sparkles } from "lucide-react";
import { getComplexity } from "@/lib/complexity";
import { motion } from "framer-motion";

interface PickerGame {
  id: string;
  title: string;
  image_url: string | null;
  slug: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time: string | null;
  difficulty: string | null;
  is_unplayed: boolean;
  is_expansion: boolean;
  library_id: string;
  created_at: string;
}

const PLAY_TIME_MINUTES: Record<string, number> = {
  "0-15 Minutes": 15, "15-30 Minutes": 30, "30-45 Minutes": 45,
  "45-60 Minutes": 60, "60+ Minutes": 90, "2+ Hours": 150, "3+ Hours": 210,
};

const DIFFICULTY_WEIGHT: Record<string, number> = {
  "1 - Light": 1, "2 - Medium Light": 2, "3 - Medium": 3,
  "4 - Medium Heavy": 4, "5 - Heavy": 5,
};

interface SmartPickerDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SmartPickerDialog({ children, open: controlledOpen, onOpenChange: controlledOnOpenChange }: SmartPickerDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const { data: myLibraries = [] } = useMyLibraries();
  const [selectedLibrary, setSelectedLibrary] = useState<string>("all");
  const [playerCount, setPlayerCount] = useState<number[]>([4]);
  const [maxTime, setMaxTime] = useState<number[]>([90]);
  const [weightRange, setWeightRange] = useState<number[]>([1, 5]);
  const [prioritizeUnplayed, setPrioritizeUnplayed] = useState(true);
  const [pickedGame, setPickedGame] = useState<PickerGame | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingGame, setAnimatingGame] = useState<PickerGame | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const libraryIds = selectedLibrary === "all"
    ? myLibraries.map(l => l.id)
    : [selectedLibrary];

  const { data: games = [] } = useQuery({
    queryKey: ["smart-picker-games", libraryIds],
    queryFn: async (): Promise<PickerGame[]> => {
      if (libraryIds.length === 0) return [];
      const { data, error } = await supabase
        .from("games")
        .select("id, title, image_url, slug, min_players, max_players, play_time, difficulty, is_unplayed, is_expansion, library_id, created_at")
        .in("library_id", libraryIds)
        .eq("is_expansion", false)
        .eq("is_coming_soon", false)
        .order("title");
      if (error) throw error;
      return data || [];
    },
    enabled: open && libraryIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const filteredGames = useMemo(() => {
    return games.filter(game => {
      const count = playerCount[0];
      if (game.min_players && count < game.min_players) return false;
      if (game.max_players && count > game.max_players) return false;
      const gameMinutes = game.play_time ? PLAY_TIME_MINUTES[game.play_time] || 60 : 60;
      if (gameMinutes > maxTime[0]) return false;
      const gameWeight = game.difficulty ? DIFFICULTY_WEIGHT[game.difficulty] || 3 : 3;
      if (gameWeight < weightRange[0] || gameWeight > weightRange[1]) return false;
      return true;
    });
  }, [games, playerCount, maxTime, weightRange]);

  const scoredGames = useMemo(() => {
    return [...filteredGames].sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      if (prioritizeUnplayed) {
        if (a.is_unplayed) scoreA += 50;
        if (b.is_unplayed) scoreB += 50;
        if (a.is_unplayed) {
          scoreA += Math.min(Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)) / 10, 30);
        }
        if (b.is_unplayed) {
          scoreB += Math.min(Math.floor((Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24)) / 10, 30);
        }
      }
      scoreA += Math.random() * 10;
      scoreB += Math.random() * 10;
      return scoreB - scoreA;
    });
  }, [filteredGames, prioritizeUnplayed]);

  const handlePick = () => {
    if (scoredGames.length === 0) return;
    setIsAnimating(true);
    setPickedGame(null);
    let iteration = 0;
    const totalIterations = 20;
    const rollNext = () => {
      const randomIdx = Math.floor(Math.random() * scoredGames.length);
      setAnimatingGame(scoredGames[randomIdx]);
      iteration++;
      if (iteration < totalIterations) {
        setTimeout(rollNext, 80 + (iteration * iteration * 2));
      } else {
        const topN = Math.min(5, scoredGames.length);
        const idx = Math.floor(Math.random() * topN);
        setAnimatingGame(null);
        setPickedGame(scoredGames[idx]);
        setIsAnimating(false);
      }
    };
    rollNext();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dices className="h-5 w-5 text-primary" />
            Random Picker
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick filter toggles */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
            </Button>
            <Button
              variant={prioritizeUnplayed ? "secondary" : "outline"}
              size="sm"
              onClick={() => setPrioritizeUnplayed(!prioritizeUnplayed)}
              className="gap-1.5"
            >
              <BookX className="h-3.5 w-3.5" />
              Unplayed First
            </Button>
          </div>

          {/* Collapsible filters */}
          {showFilters && (
            <div className="space-y-4 p-3 rounded-lg bg-muted/50 border">
              {myLibraries.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Library</Label>
                  <Select value={selectedLibrary} onValueChange={setSelectedLibrary}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All My Libraries</SelectItem>
                      {myLibraries.map(lib => (
                        <SelectItem key={lib.id} value={lib.id}>{lib.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <Users className="h-3.5 w-3.5" /> Players: {playerCount[0]}
                </Label>
                <Slider value={playerCount} onValueChange={setPlayerCount} min={1} max={10} step={1} />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <Clock className="h-3.5 w-3.5" /> Max Time: {maxTime[0]} min
                </Label>
                <Slider value={maxTime} onValueChange={setMaxTime} min={15} max={240} step={15} />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <Weight className="h-3.5 w-3.5" /> Complexity: {weightRange[0]}–{weightRange[1]}
                </Label>
                <Slider value={weightRange} onValueChange={setWeightRange} min={1} max={5} step={1} />
              </div>
            </div>
          )}

          {/* Status */}
          <p className="text-xs text-muted-foreground">
            {filteredGames.length} game{filteredGames.length !== 1 ? "s" : ""} match your criteria
          </p>

          {/* Spin button */}
          <Button
            onClick={handlePick}
            disabled={filteredGames.length === 0 || isAnimating}
            className="w-full gap-2"
            size="lg"
          >
            {isAnimating ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}>
                <Dices className="h-5 w-5" />
              </motion.div>
            ) : (
              <Dices className="h-5 w-5" />
            )}
            {isAnimating ? "Rolling..." : pickedGame ? "Pick Again" : "Spin to Pick!"}
          </Button>

          {/* Rolling animation */}
          {isAnimating && animatingGame && (
            <div className="p-3 rounded-lg bg-muted/50 border text-center overflow-hidden">
              <motion.div
                key={animatingGame.id}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 0.7 }}
                transition={{ duration: 0.06 }}
              >
                {animatingGame.image_url && (
                  <img src={animatingGame.image_url} alt={animatingGame.title} className="w-20 h-20 mx-auto rounded-lg object-cover mb-1.5 opacity-60" />
                )}
                <h3 className="font-display text-base text-muted-foreground">{animatingGame.title}</h3>
              </motion.div>
            </div>
          )}

          {/* Result */}
          {!isAnimating && pickedGame && (
            <motion.div
              key={"result-" + pickedGame.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="p-4 rounded-lg bg-secondary/10 border border-secondary/30 text-center"
            >
              {pickedGame.image_url && (
                <img src={pickedGame.image_url} alt={pickedGame.title} className="w-28 h-28 mx-auto rounded-lg object-cover mb-2" />
              )}
              <h3 className="font-display text-lg font-bold">{pickedGame.title}</h3>
              <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                {pickedGame.play_time && (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />{pickedGame.play_time}
                  </Badge>
                )}
                {pickedGame.min_players && pickedGame.max_players && (
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />{pickedGame.min_players}–{pickedGame.max_players}
                  </Badge>
                )}
                {(() => {
                  const c = getComplexity((pickedGame as any).weight);
                  return c ? (
                    <Badge className={`text-xs ${c.badgeClass}`}>
                      <span className={`h-2 w-2 rounded-full ${c.dotClass} mr-1 inline-block`} />
                      {c.label}
                    </Badge>
                  ) : null;
                })()}
                {pickedGame.is_unplayed && (
                  <Badge variant="secondary" className="text-xs">
                    <BookX className="h-3 w-3 mr-1" />Unplayed!
                  </Badge>
                )}
              </div>
            </motion.div>
          )}

          {/* Top suggestions */}
          {scoredGames.length > 0 && !isAnimating && (
            <div className="space-y-1 mt-2">
              <p className="text-xs text-muted-foreground font-medium">Top suggestions:</p>
              {scoredGames.slice(0, 5).map(game => (
                <div
                  key={game.id}
                  className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setPickedGame(game)}
                >
                  {game.image_url ? (
                    <img src={game.image_url} alt={game.title} className="w-7 h-7 rounded object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded bg-muted flex items-center justify-center">
                      <Dices className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-sm flex-1 truncate">{game.title}</span>
                  {game.is_unplayed && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Shame</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
