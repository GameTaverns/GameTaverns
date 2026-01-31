import { useState, useCallback, useEffect, useMemo } from "react";
import { 
  Dices, 
  Heart, 
  Filter, 
  Hand, 
  Share2, 
  RotateCcw,
  Sparkles,
  ChevronDown,
  X,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { GameImage } from "./GameImage";
import { motion, AnimatePresence } from "framer-motion";
import { GENRE_OPTIONS } from "@/types/game";

// Types
interface Game {
  id: string;
  title: string;
  image_url: string | null;
  slug: string | null;
  difficulty: string | null;
  game_type: string | null;
  play_time: string | null;
  min_players: number | null;
  max_players: number | null;
  genre: string | null;
}

interface RandomGamePickerProps {
  libraryId: string;
  librarySlug?: string;
}

type PickerMode = "wishlist" | "filter" | "manual";

const GAME_TYPES = [
  "Board Game",
  "Card Game",
  "Dice Game",
  "Party Game",
  "War Game",
  "Miniatures",
  "RPG",
  "Other",
];

const PLAY_TIMES = [
  "0-15 Minutes",
  "15-30 Minutes",
  "30-45 Minutes",
  "45-60 Minutes",
  "60+ Minutes",
  "2+ Hours",
  "3+ Hours",
];

export function RandomGamePicker({ libraryId, librarySlug }: RandomGamePickerProps) {
  const [mode, setMode] = useState<PickerMode>("wishlist");
  const [isSpinning, setIsSpinning] = useState(false);
  const [pickedGame, setPickedGame] = useState<Game | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Filter state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedPlayTimes, setSelectedPlayTimes] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState<string>("");
  
  // Manual selection state
  const [manualGames, setManualGames] = useState<Game[]>([]);
  const [showGameSelector, setShowGameSelector] = useState(false);
  
  // Fetch all games for the library
  const { data: allGames = [] } = useQuery({
    queryKey: ["picker-games", libraryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id, title, image_url, slug, difficulty, game_type, play_time, min_players, max_players, genre")
        .eq("library_id", libraryId)
        .eq("is_expansion", false)
        .eq("is_coming_soon", false)
        .order("title");
      if (error) throw error;
      return data as Game[];
    },
    enabled: !!libraryId,
  });
  
  // Fetch wishlist with vote counts
  const { data: wishlistData = [] } = useQuery({
    queryKey: ["picker-wishlist", libraryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_wishlist_summary")
        .select("game_id, vote_count");
      if (error) throw error;
      return data;
    },
    enabled: mode === "wishlist",
  });
  
  // Get eligible games based on mode
  const eligibleGames = useMemo(() => {
    if (mode === "wishlist") {
      // Games with wishlist votes, sorted by votes
      const votedIds = new Set(wishlistData.map(w => w.game_id));
      return allGames
        .filter(g => votedIds.has(g.id))
        .sort((a, b) => {
          const aVotes = wishlistData.find(w => w.game_id === a.id)?.vote_count || 0;
          const bVotes = wishlistData.find(w => w.game_id === b.id)?.vote_count || 0;
          return Number(bVotes) - Number(aVotes);
        });
    }
    
    if (mode === "filter") {
      return allGames.filter(game => {
        // Type filter
        if (selectedTypes.length > 0 && game.game_type && !selectedTypes.includes(game.game_type)) {
          return false;
        }
        // Genre filter
        if (selectedGenres.length > 0 && (!game.genre || !selectedGenres.includes(game.genre))) {
          return false;
        }
        // Play time filter
        if (selectedPlayTimes.length > 0 && game.play_time && !selectedPlayTimes.includes(game.play_time)) {
          return false;
        }
        // Player count filter
        if (playerCount) {
          const count = parseInt(playerCount);
          if (game.min_players && count < game.min_players) return false;
          if (game.max_players && count > game.max_players) return false;
        }
        return true;
      });
    }
    
    if (mode === "manual") {
      return manualGames;
    }
    
    return [];
  }, [mode, allGames, wishlistData, selectedTypes, selectedGenres, selectedPlayTimes, playerCount, manualGames]);
  
  // Spin and pick a random game
  const handleSpin = useCallback(() => {
    if (eligibleGames.length === 0) return;
    
    setIsSpinning(true);
    setPickedGame(null);
    
    // Simulate spinning through games
    let iterations = 0;
    const maxIterations = 20;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * eligibleGames.length);
      setPickedGame(eligibleGames[randomIndex]);
      iterations++;
      
      if (iterations >= maxIterations) {
        clearInterval(interval);
        // Final pick
        const finalIndex = Math.floor(Math.random() * eligibleGames.length);
        setPickedGame(eligibleGames[finalIndex]);
        setIsSpinning(false);
        setShowResult(true);
      }
    }, 100);
  }, [eligibleGames]);
  
  // Instant pick (no animation)
  const handleInstantPick = useCallback(() => {
    if (eligibleGames.length === 0) return;
    const randomIndex = Math.floor(Math.random() * eligibleGames.length);
    setPickedGame(eligibleGames[randomIndex]);
    setShowResult(true);
  }, [eligibleGames]);
  
  // Share result
  const handleShare = useCallback(async () => {
    if (!pickedGame || !librarySlug) return;
    
    const shareUrl = `${window.location.origin}/?tenant=${librarySlug}&path=/games/${pickedGame.slug || pickedGame.id}`;
    
    try {
      await navigator.clipboard.writeText(
        `🎲 Tonight's game pick: ${pickedGame.title}!\n\n${shareUrl}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [pickedGame, librarySlug]);
  
  // Reset picker
  const handleReset = () => {
    setPickedGame(null);
    setShowResult(false);
  };
  
  // Toggle game type filter
  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };
  
  // Toggle play time filter
  const togglePlayTime = (time: string) => {
    setSelectedPlayTimes(prev => 
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  };
  
  // Toggle genre filter
  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };
  
  // Add game to manual selection
  const addManualGame = (game: Game) => {
    if (!manualGames.find(g => g.id === game.id) && manualGames.length < 6) {
      setManualGames(prev => [...prev, game]);
    }
    setShowGameSelector(false);
  };
  
  // Remove game from manual selection
  const removeManualGame = (gameId: string) => {
    setManualGames(prev => prev.filter(g => g.id !== gameId));
  };
  
  return (
    <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Dices className="h-5 w-5 text-secondary" />
          Random Game Picker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Selector */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={mode === "wishlist" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("wishlist")}
            className={cn(
              mode === "wishlist" 
                ? "bg-secondary text-secondary-foreground" 
                : "border-secondary/50 text-cream hover:bg-wood-medium/50"
            )}
          >
            <Heart className="h-4 w-4 mr-1" />
            Wishlist
          </Button>
          <Button
            variant={mode === "filter" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("filter")}
            className={cn(
              mode === "filter" 
                ? "bg-secondary text-secondary-foreground" 
                : "border-secondary/50 text-cream hover:bg-wood-medium/50"
            )}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filter
          </Button>
          <Button
            variant={mode === "manual" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("manual")}
            className={cn(
              mode === "manual" 
                ? "bg-secondary text-secondary-foreground" 
                : "border-secondary/50 text-cream hover:bg-wood-medium/50"
            )}
          >
            <Hand className="h-4 w-4 mr-1" />
            Pick Games
          </Button>
        </div>
        
        {/* Mode-specific controls */}
        <AnimatePresence mode="wait">
          {mode === "wishlist" && (
            <motion.div
              key="wishlist"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-cream/70"
            >
              {eligibleGames.length > 0 ? (
                <p>Picking from {eligibleGames.length} wishlisted games</p>
              ) : (
                <p className="text-amber-400">No games on wishlist yet</p>
              )}
            </motion.div>
          )}
          
          {mode === "filter" && (
            <motion.div
              key="filter"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              {/* Game Type */}
              <div>
                <Label className="text-xs text-cream/70 mb-1 block">Game Type</Label>
                <div className="flex flex-wrap gap-1">
                  {GAME_TYPES.map(type => (
              <Badge
                      key={type}
                      variant={selectedTypes.includes(type) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer text-xs",
                        selectedTypes.includes(type) 
                          ? "bg-secondary text-secondary-foreground" 
                          : "border-muted-foreground/30 text-muted-foreground hover:bg-muted/50"
                      )}
                      onClick={() => toggleType(type)}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
                </div>
              
              {/* Genre */}
              <div>
                <Label className="text-xs text-cream/70 mb-1 block">Genre</Label>
                <div className="flex flex-wrap gap-1">
                  {GENRE_OPTIONS.map(genre => (
                    <Badge
                      key={genre}
                      variant={selectedGenres.includes(genre) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer text-xs",
                        selectedGenres.includes(genre) 
                          ? "bg-secondary text-secondary-foreground" 
                          : "border-muted-foreground/30 text-muted-foreground hover:bg-muted/50"
                      )}
                      onClick={() => toggleGenre(genre)}
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Play Time */}
              <div>
                <Label className="text-xs text-cream/70 mb-1 block">Play Time</Label>
                <div className="flex flex-wrap gap-1">
                  {PLAY_TIMES.slice(0, 5).map(time => (
              <Badge
                      key={time}
                      variant={selectedPlayTimes.includes(time) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer text-xs",
                        selectedPlayTimes.includes(time) 
                          ? "bg-secondary text-secondary-foreground" 
                          : "border-muted-foreground/30 text-muted-foreground hover:bg-muted/50"
                      )}
                      onClick={() => togglePlayTime(time)}
                    >
                      {time}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Player Count */}
              <div>
                <Label className="text-xs text-cream/70 mb-1 block">Player Count</Label>
                <Select value={playerCount} onValueChange={(val) => setPlayerCount(val === "any" ? "" : val)}>
                  <SelectTrigger className="w-32 h-8 bg-wood-medium/20 border-cream/20">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n} players</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <p className="text-xs text-cream/60">
                {eligibleGames.length} games match filters
              </p>
            </motion.div>
          )}
          
          {mode === "manual" && (
            <motion.div
              key="manual"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              {/* Selected games */}
              {manualGames.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {manualGames.map(game => (
                    <Badge
                      key={game.id}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {game.title}
                      <button
                        onClick={() => removeManualGame(game.id)}
                        className="ml-1 hover:bg-secondary-foreground/20 rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* Add game button */}
              {manualGames.length < 6 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGameSelector(true)}
                  className="border-dashed border-cream/30 text-cream/70 hover:bg-wood-medium/50"
                >
                  + Add Game ({manualGames.length}/6)
                </Button>
              )}
              
              {manualGames.length < 2 && (
                <p className="text-xs text-amber-400">Add at least 2 games to pick from</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Spin buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSpin}
            disabled={isSpinning || eligibleGames.length < 2}
            className="flex-1 bg-gradient-to-r from-secondary to-primary hover:from-secondary/90 hover:to-primary/90"
          >
            {isSpinning ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                >
                  <Dices className="h-4 w-4 mr-2" />
                </motion.div>
                Spinning...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Spin to Pick!
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleInstantPick}
            disabled={isSpinning || eligibleGames.length < 2}
            className="border-cream/30 text-cream hover:bg-wood-medium/50"
            title="Instant pick (no animation)"
          >
            <Dices className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Spinning preview */}
        <AnimatePresence>
          {isSpinning && pickedGame && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 p-3 bg-wood-medium/40 rounded-lg"
            >
              <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                <GameImage
                  imageUrl={pickedGame.image_url || "/placeholder.svg"}
                  alt={pickedGame.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <motion.p
                  key={pickedGame.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-medium truncate"
                >
                  {pickedGame.title}
                </motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Result Dialog */}
        <Dialog open={showResult} onOpenChange={setShowResult}>
          <DialogContent className="bg-wood-dark border-wood-medium text-cream max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-secondary" />
                Tonight's Pick!
              </DialogTitle>
            </DialogHeader>
            
            {pickedGame && (
              <div className="space-y-4">
                <div className="relative aspect-video rounded-lg overflow-hidden">
                  <GameImage
                    imageUrl={pickedGame.image_url || "/placeholder.svg"}
                    alt={pickedGame.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-2xl font-display font-bold text-white">
                      {pickedGame.title}
                    </h3>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {pickedGame.game_type && (
                        <Badge variant="secondary" className="text-xs">
                          {pickedGame.game_type}
                        </Badge>
                      )}
                      {pickedGame.play_time && (
                        <Badge variant="outline" className="text-xs border-white/30 text-white">
                          {pickedGame.play_time}
                        </Badge>
                      )}
                      {pickedGame.min_players && pickedGame.max_players && (
                        <Badge variant="outline" className="text-xs border-white/30 text-white">
                          {pickedGame.min_players}-{pickedGame.max_players} players
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleShare}
                    className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share Pick
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="border-cream/30 text-cream hover:bg-wood-medium/50"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Pick Again
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Game Selector Dialog for Manual Mode */}
        <Dialog open={showGameSelector} onOpenChange={setShowGameSelector}>
          <DialogContent className="bg-wood-dark border-wood-medium text-cream max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Select a Game</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 -mx-6 px-6">
              <div className="space-y-1">
                {allGames
                  .filter(g => !manualGames.find(m => m.id === g.id))
                  .map(game => (
                    <button
                      key={game.id}
                      onClick={() => addManualGame(game)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-wood-medium/40 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                        <GameImage
                          imageUrl={game.image_url || "/placeholder.svg"}
                          alt={game.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{game.title}</p>
                        {game.game_type && (
                          <p className="text-xs text-cream/60">{game.game_type}</p>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
