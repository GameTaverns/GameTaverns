import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useMyLibraries } from "@/hooks/useLibrary";
import { useCuratedList } from "@/hooks/useCuratedLists";
import { useMechanicFamilies, useGameMechanicFamilyMap } from "@/hooks/useMechanicFamilies";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Dices, Heart, Filter, Hand, List } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PickerFilterTab } from "./picker/PickerFilterTab";
import { PickerPickGamesTab } from "./picker/PickerPickGamesTab";
import { PickerMyListsTab } from "./picker/PickerMyListsTab";
import { PickerResult } from "./picker/PickerResult";

interface PickerGame {
  id: string;
  title: string;
  image_url: string | null;
  slug: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time: string | null;
  difficulty: string | null;
  game_type: string | null;
  genre: string | null;
  is_unplayed: boolean;
  is_expansion: boolean;
  library_id: string;
  created_at: string;
}

type PickerMode = "want_to_play" | "filter" | "pick_games" | "my_lists";

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
  const libraryIds = myLibraries.map(l => l.id);

  // Mode
  const [mode, setMode] = useState<PickerMode>("filter");

  // Filter state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedMechanics, setSelectedMechanics] = useState<string[]>([]);
  const [selectedPlayTimes, setSelectedPlayTimes] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState("any");

  // Pick Games state
  const [pickedGameIds, setPickedGameIds] = useState<string[]>([]);

  // My Lists state
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const { data: selectedList } = useCuratedList(selectedListId);

  // Result state
  const [pickedGame, setPickedGame] = useState<PickerGame | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingGame, setAnimatingGame] = useState<PickerGame | null>(null);

  // Fetch all library games
  const { data: games = [] } = useQuery({
    queryKey: ["smart-picker-games", libraryIds],
    queryFn: async (): Promise<PickerGame[]> => {
      if (libraryIds.length === 0) return [];
      const { data, error } = await supabase
        .from("games")
        .select("id, title, image_url, slug, min_players, max_players, play_time, difficulty, game_type, genre, is_unplayed, is_expansion, library_id, created_at")
        .in("library_id", libraryIds)
        .eq("is_expansion", false)
        .eq("is_coming_soon", false)
        .order("title");
      if (error) throw error;
      return (data || []) as PickerGame[];
    },
    enabled: open && libraryIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch mechanic families list + game→family mapping
  const { data: mechanicFamilies = [] } = useMechanicFamilies();
  const gameIds = useMemo(() => games.map(g => g.id), [games]);
  const { data: gameMechanicMap } = useGameMechanicFamilyMap(gameIds, open && games.length > 0);
  const mechanicFamilyNames = useMemo(() => mechanicFamilies.map(f => f.name), [mechanicFamilies]);

  const toggleArrayItem = useCallback((arr: string[], item: string) => {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  }, []);

  // Get eligible games based on current mode
  const eligibleGames = useMemo((): PickerGame[] => {
    if (mode === "want_to_play") {
      return games.filter(g => g.is_unplayed);
    }

    if (mode === "filter") {
      return games.filter(game => {
        if (selectedTypes.length > 0 && (!game.game_type || !selectedTypes.includes(game.game_type))) return false;
        if (selectedGenres.length > 0 && (!game.genre || !selectedGenres.some(g => game.genre?.toLowerCase().includes(g.toLowerCase())))) return false;
        if (selectedPlayTimes.length > 0 && (!game.play_time || !selectedPlayTimes.includes(game.play_time))) return false;
        if (playerCount !== "any") {
          const count = parseInt(playerCount);
          if (game.min_players && count < game.min_players) return false;
          if (game.max_players && count > game.max_players) return false;
        }
        return true;
      });
    }

    if (mode === "pick_games") {
      return games.filter(g => pickedGameIds.includes(g.id));
    }

    if (mode === "my_lists" && selectedList?.items) {
      const listGameIds = selectedList.items.map(i => i.game_id);
      return games.filter(g => listGameIds.includes(g.id));
    }

    return games;
  }, [mode, games, selectedTypes, selectedGenres, selectedPlayTimes, playerCount, pickedGameIds, selectedList]);

  const handlePick = () => {
    if (eligibleGames.length === 0) return;
    setIsAnimating(true);
    setPickedGame(null);
    let iteration = 0;
    const totalIterations = 20;
    const rollNext = () => {
      const randomIdx = Math.floor(Math.random() * eligibleGames.length);
      setAnimatingGame(eligibleGames[randomIdx]);
      iteration++;
      if (iteration < totalIterations) {
        setTimeout(rollNext, 80 + (iteration * iteration * 2));
      } else {
        const idx = Math.floor(Math.random() * eligibleGames.length);
        setAnimatingGame(null);
        setPickedGame(eligibleGames[idx]);
        setIsAnimating(false);
      }
    };
    rollNext();
  };

  const modes: { key: PickerMode; label: string; icon: React.ElementType }[] = [
    { key: "want_to_play", label: "Want to Play", icon: Heart },
    { key: "filter", label: "Filter", icon: Filter },
    { key: "pick_games", label: "Pick Games", icon: Hand },
    { key: "my_lists", label: "My Lists", icon: List },
  ];

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
          {/* Sub-header */}
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <Dices className="h-4 w-4 text-primary" />
            Random Game Picker
          </h3>

          {/* Mode tabs */}
          <div className="flex flex-wrap gap-2">
            {modes.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => { setMode(m.key); setPickedGame(null); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-colors",
                    mode === m.key
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-transparent border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Mode content */}
          {mode === "filter" && (
            <PickerFilterTab
              selectedTypes={selectedTypes}
              toggleType={t => setSelectedTypes(prev => toggleArrayItem(prev, t))}
              selectedGenres={selectedGenres}
              toggleGenre={g => setSelectedGenres(prev => toggleArrayItem(prev, g))}
              selectedPlayTimes={selectedPlayTimes}
              togglePlayTime={pt => setSelectedPlayTimes(prev => toggleArrayItem(prev, pt))}
              playerCount={playerCount}
              setPlayerCount={setPlayerCount}
            />
          )}

          {mode === "pick_games" && (
            <PickerPickGamesTab
              games={games}
              selectedIds={pickedGameIds}
              toggleGame={id => setPickedGameIds(prev => toggleArrayItem(prev, id))}
            />
          )}

          {mode === "my_lists" && (
            <PickerMyListsTab
              selectedListId={selectedListId}
              onSelectList={setSelectedListId}
            />
          )}

          {mode === "want_to_play" && (
            <p className="text-xs text-muted-foreground">
              Picks from games you haven't played yet in your library.
            </p>
          )}

          {/* Match count */}
          <p className="text-xs text-muted-foreground">
            {eligibleGames.length} game{eligibleGames.length !== 1 ? "s" : ""} match filters
          </p>

          {/* Spin button */}
          <Button
            onClick={handlePick}
            disabled={eligibleGames.length === 0 || isAnimating}
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
            {isAnimating ? "Rolling..." : pickedGame ? "Spin Again" : "Spin to Pick!"}
          </Button>

          {/* Animation / Result */}
          {isAnimating && animatingGame && (
            <PickerResult game={animatingGame} isAnimating />
          )}
          {!isAnimating && pickedGame && (
            <PickerResult game={pickedGame} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
