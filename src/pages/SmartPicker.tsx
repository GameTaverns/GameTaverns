import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibraries } from "@/hooks/useLibrary";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dices, Users, Clock, Weight, BookX, Shuffle, Filter, Sparkles, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GameImage } from "@/components/games/GameImage";

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
  "0-15 Minutes": 15,
  "15-30 Minutes": 30,
  "30-45 Minutes": 45,
  "45-60 Minutes": 60,
  "60+ Minutes": 90,
  "2+ Hours": 150,
  "3+ Hours": 210,
};

const DIFFICULTY_WEIGHT: Record<string, number> = {
  "1 - Light": 1,
  "2 - Medium Light": 2,
  "3 - Medium": 3,
  "4 - Medium Heavy": 4,
  "5 - Heavy": 5,
};

export default function SmartPicker() {
  const { isAuthenticated, loading } = useAuth();
  const { data: myLibraries = [] } = useMyLibraries();
  const [selectedLibrary, setSelectedLibrary] = useState<string>("all");
  const [playerCount, setPlayerCount] = useState<number[]>([4]);
  const [maxTime, setMaxTime] = useState<number[]>([90]);
  const [weightRange, setWeightRange] = useState<number[]>([1, 5]);
  const [prioritizeUnplayed, setPrioritizeUnplayed] = useState(true);
  const [pickedGame, setPickedGame] = useState<PickerGame | null>(null);

  const libraryIds = selectedLibrary === "all"
    ? myLibraries.map(l => l.id)
    : [selectedLibrary];

  const { data: games = [], isLoading } = useQuery({
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
    enabled: libraryIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Filter and score games
  const filteredGames = useMemo(() => {
    return games.filter(game => {
      // Player count filter
      const count = playerCount[0];
      if (game.min_players && count < game.min_players) return false;
      if (game.max_players && count > game.max_players) return false;

      // Time filter
      const gameMinutes = game.play_time ? PLAY_TIME_MINUTES[game.play_time] || 60 : 60;
      if (gameMinutes > maxTime[0]) return false;

      // Weight filter
      const gameWeight = game.difficulty ? DIFFICULTY_WEIGHT[game.difficulty] || 3 : 3;
      if (gameWeight < weightRange[0] || gameWeight > weightRange[1]) return false;

      return true;
    });
  }, [games, playerCount, maxTime, weightRange]);

  // Score and sort
  const scoredGames = useMemo(() => {
    return [...filteredGames].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Shelf of Shame boost: prioritize unplayed games
      if (prioritizeUnplayed) {
        if (a.is_unplayed) scoreA += 50;
        if (b.is_unplayed) scoreB += 50;

        // Extra boost for older unplayed games
        if (a.is_unplayed) {
          const daysA = Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24));
          scoreA += Math.min(daysA / 10, 30);
        }
        if (b.is_unplayed) {
          const daysB = Math.floor((Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24));
          scoreB += Math.min(daysB / 10, 30);
        }
      }

      // Add small random factor for variety
      scoreA += Math.random() * 10;
      scoreB += Math.random() * 10;

      return scoreB - scoreA;
    });
  }, [filteredGames, prioritizeUnplayed]);

  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingGame, setAnimatingGame] = useState<PickerGame | null>(null);

  const handlePick = () => {
    if (scoredGames.length === 0) return;
    
    setIsAnimating(true);
    setPickedGame(null);
    
    // Roll through games with decreasing speed
    let iteration = 0;
    const totalIterations = 20;
    
    const rollNext = () => {
      const randomIdx = Math.floor(Math.random() * scoredGames.length);
      setAnimatingGame(scoredGames[randomIdx]);
      iteration++;
      
      if (iteration < totalIterations) {
        // Slow down progressively
        const delay = 80 + (iteration * iteration * 2);
        setTimeout(rollNext, delay);
      } else {
        // Final pick
        const topN = Math.min(5, scoredGames.length);
        const idx = Math.floor(Math.random() * topN);
        const finalPick = scoredGames[idx];
        setAnimatingGame(null);
        setPickedGame(finalPick);
        setIsAnimating(false);
      }
    };
    
    rollNext();
  };

  if (loading) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-4">
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">Smart Game Picker</h1>
          <p className="text-muted-foreground text-lg">
            Tell us about your group and we'll find the perfect game
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Filters Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Your Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Library Selection */}
              {myLibraries.length > 1 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Library</Label>
                  <Select value={selectedLibrary} onValueChange={setSelectedLibrary}>
                    <SelectTrigger>
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

              {/* Player Count */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Players: {playerCount[0]}
                </Label>
                <Slider
                  value={playerCount}
                  onValueChange={setPlayerCount}
                  min={1}
                  max={10}
                  step={1}
                />
              </div>

              {/* Max Time */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  Max Time: {maxTime[0]} min
                </Label>
                <Slider
                  value={maxTime}
                  onValueChange={setMaxTime}
                  min={15}
                  max={240}
                  step={15}
                />
              </div>

              {/* Weight Range */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Weight className="h-4 w-4" />
                  Complexity: {weightRange[0]} – {weightRange[1]}
                </Label>
                <Slider
                  value={weightRange}
                  onValueChange={setWeightRange}
                  min={1}
                  max={5}
                  step={1}
                />
              </div>

              {/* Shame Toggle */}
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <BookX className="h-4 w-4" />
                  Prioritize unplayed games
                </Label>
                <Switch
                  checked={prioritizeUnplayed}
                  onCheckedChange={setPrioritizeUnplayed}
                />
              </div>
            </CardContent>
          </Card>

          {/* Results Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Pick a Game
              </CardTitle>
              <CardDescription>
                {filteredGames.length} game{filteredGames.length !== 1 ? "s" : ""} match your criteria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                {isAnimating ? "Rolling..." : pickedGame ? "Pick Again" : "Pick a Game!"}
              </Button>

              {/* Animated rolling display */}
              {isAnimating && animatingGame && (
                <div className="p-4 rounded-lg bg-muted/50 border border-border text-center overflow-hidden">
                  <motion.div
                    key={animatingGame.id}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 0.7 }}
                    transition={{ duration: 0.06 }}
                  >
                    {animatingGame.image_url && (
                      <img
                        src={animatingGame.image_url}
                        alt={animatingGame.title}
                        className="w-24 h-24 mx-auto rounded-lg object-cover mb-2 opacity-60"
                      />
                    )}
                    <h3 className="font-display text-lg text-muted-foreground">{animatingGame.title}</h3>
                  </motion.div>
                </div>
              )}

              {!isAnimating && pickedGame && (
                <motion.div
                  key={"result-" + pickedGame.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="p-4 rounded-lg bg-secondary/10 border border-secondary/30 text-center"
                >
                  {pickedGame.image_url && (
                    <img
                      src={pickedGame.image_url}
                      alt={pickedGame.title}
                      className="w-32 h-32 mx-auto rounded-lg object-cover mb-3"
                    />
                  )}
                  <h3 className="font-display text-xl font-bold">{pickedGame.title}</h3>
                  <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                    {pickedGame.play_time && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {pickedGame.play_time}
                      </Badge>
                    )}
                    {pickedGame.min_players && pickedGame.max_players && (
                      <Badge variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {pickedGame.min_players}–{pickedGame.max_players}
                      </Badge>
                    )}
                    {pickedGame.difficulty && (
                      <Badge variant="outline" className="text-xs">
                        <Weight className="h-3 w-3 mr-1" />
                        {pickedGame.difficulty}
                      </Badge>
                    )}
                    {pickedGame.is_unplayed && (
                      <Badge variant="secondary" className="text-xs">
                        <BookX className="h-3 w-3 mr-1" />
                        Unplayed!
                      </Badge>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Top suggestions list */}
              {scoredGames.length > 0 && (
                <div className="space-y-1.5 mt-4">
                  <p className="text-xs text-muted-foreground font-medium">Top suggestions:</p>
                  {scoredGames.slice(0, 8).map(game => (
                    <div
                      key={game.id}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setPickedGame(game)}
                    >
                      {game.image_url ? (
                        <img src={game.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <Dices className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="text-sm flex-1 truncate">{game.title}</span>
                      {game.is_unplayed && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Shame
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
