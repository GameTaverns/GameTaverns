import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Clock, Dice5, Shuffle, CalendarClock, Gamepad2,
  BookOpen, Search, CheckCircle, Loader2, XCircle,
  Heart, Filter, Hand, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { PickerChip } from "@/components/games/picker/PickerChip";
import { useMechanicFamilies, useGameMechanicFamilyMap } from "@/hooks/useMechanicFamilies";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { GENRE_OPTIONS } from "@/types/game";

const GAME_TYPES = ["Board Game", "Card Game", "Dice Game", "Party Game", "War Game", "Miniatures", "RPG", "Other"];
const PLAY_TIMES = ["0-15 Minutes", "15-30 Minutes", "30-45 Minutes", "45-60 Minutes", "60+ Minutes"];

type ConciergeMode = "all" | "want_to_play" | "filter";

interface Props {
  event: any;
  libraryGames: any[];
  activeLoans: any[];
  conventionSettings: any;
}

export function ConventionConcierge({ event, libraryGames, activeLoans, conventionSettings }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Mode
  const [mode, setMode] = useState<ConciergeMode>("all");

  // Filter state (matching SmartPickerDialog)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedMechanics, setSelectedMechanics] = useState<string[]>([]);
  const [selectedPlayTimes, setSelectedPlayTimes] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState("any");

  // Mechanic families
  const { data: mechanicFamilies = [] } = useMechanicFamilies();
  const gameIds = useMemo(() => libraryGames.map((g: any) => g.id), [libraryGames]);
  const { data: gameMechanicMap } = useGameMechanicFamilyMap(gameIds, gameIds.length > 0);
  const mechanicFamilyNames = useMemo(() => mechanicFamilies.map(f => f.name), [mechanicFamilies]);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  // Other state
  const [spinning, setSpinning] = useState(false);
  const [pickedGame, setPickedGame] = useState<any>(null);
  const [animatingGame, setAnimatingGame] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reservedGameId, setReservedGameId] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);

  const toggleArrayItem = useCallback((arr: string[], item: string) => {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  }, []);

  // Create reservation mutation
  const createReservation = useMutation({
    mutationFn: async (gameId: string) => {
      if (!conventionSettings?.id || !user?.id) throw new Error("Missing context");
      const holdMinutes = conventionSettings.reservation_hold_minutes || 30;
      const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("convention_reservations")
        .insert({
          convention_event_id: conventionSettings.id,
          game_id: gameId,
          reserved_by: user.id,
          expires_at: expiresAt,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, gameId) => {
      setReservedGameId(gameId);
      setReservationId(data.id);
      queryClient.invalidateQueries({ queryKey: ["convention-reservations"] });
      toast({ title: "Game reserved!", description: `Held for ${conventionSettings?.reservation_hold_minutes || 30} minutes.` });
    },
    onError: (err: any) => {
      toast({ title: "Reservation failed", description: err.message, variant: "destructive" });
    },
  });

  // Cancel reservation mutation
  const cancelReservation = useMutation({
    mutationFn: async (resId: string) => {
      const { error } = await supabase
        .from("convention_reservations")
        .update({ status: "cancelled" })
        .eq("id", resId);
      if (error) throw error;
    },
    onSuccess: () => {
      setReservedGameId(null);
      setReservationId(null);
      queryClient.invalidateQueries({ queryKey: ["convention-reservations"] });
      toast({ title: "Reservation cancelled" });
    },
  });

  // Compute availability
  const gamesWithAvailability = useMemo(() => {
    return libraryGames.map((g: any) => {
      const loansOut = activeLoans.filter((l: any) => l.game_id === g.id).length;
      return { ...g, loansOut, available: Math.max(0, (g.copies_owned || 1) - loansOut) };
    });
  }, [libraryGames, activeLoans]);

  // Apply filters
  const filteredGames = useMemo(() => {
    let games = gamesWithAvailability;

    // Mode filters
    if (mode === "want_to_play") {
      games = games.filter(g => g.is_unplayed);
    }

    if (mode === "filter" || mode === "all") {
      if (selectedTypes.length > 0) {
        games = games.filter(g => g.game_type && selectedTypes.includes(g.game_type));
      }
      if (selectedMechanics.length > 0 && gameMechanicMap) {
        games = games.filter(g => {
          const families = gameMechanicMap.get(g.id);
          return families && selectedMechanics.some(m => families.has(m));
        });
      }
      if (selectedPlayTimes.length > 0) {
        games = games.filter(g => g.play_time && selectedPlayTimes.includes(g.play_time));
      }
      if (playerCount !== "any") {
        const count = parseInt(playerCount);
        games = games.filter(g => g.min_players != null && g.max_players != null && g.min_players <= count && g.max_players >= count);
      }
    }

    if (searchQuery.trim()) {
      games = games.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return games;
  }, [gamesWithAvailability, mode, selectedTypes, selectedMechanics, selectedPlayTimes, playerCount, searchQuery, gameMechanicMap]);

  const availableGames = filteredGames.filter(g => g.available > 0);
  const activeFilterCount = selectedTypes.length + selectedMechanics.length + selectedPlayTimes.length + (playerCount !== "any" ? 1 : 0);

  const handleSpin = () => {
    if (availableGames.length === 0) return;
    setSpinning(true);
    setPickedGame(null);
    setAnimatingGame(null);
    setReservedGameId(null);
    setReservationId(null);
    let iteration = 0;
    const totalIterations = 20;
    const rollNext = () => {
      const randomIdx = Math.floor(Math.random() * availableGames.length);
      setAnimatingGame(availableGames[randomIdx]);
      iteration++;
      if (iteration < totalIterations) {
        setTimeout(rollNext, 80 + (iteration * iteration * 2));
      } else {
        const idx = Math.floor(Math.random() * availableGames.length);
        setAnimatingGame(null);
        setPickedGame(availableGames[idx]);
        setSpinning(false);
      }
    };
    rollNext();
  };

  const handleReserve = (gameId: string) => {
    createReservation.mutate(gameId);
  };

  const clearFilters = () => {
    setSelectedTypes([]);
    setSelectedMechanics([]);
    setSelectedPlayTimes([]);
    setPlayerCount("any");
    setSearchQuery("");
  };

  const modes: { key: ConciergeMode; label: string; icon: React.ElementType }[] = [
    { key: "all", label: "All Games", icon: Gamepad2 },
    { key: "want_to_play", label: "Want to Play", icon: Heart },
    { key: "filter", label: "Filtered", icon: Filter },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 py-4">
        <h2 className="text-3xl font-display text-primary">🎲 Game Concierge</h2>
        <p className="text-muted-foreground">Find your next game · {availableGames.length} available</p>
      </div>

      {/* Mode Tabs */}
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {modes.map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => { setMode(m.key); setPickedGame(null); setAnimatingGame(null); }}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                  mode === m.key
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-transparent border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Filters Panel */}
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">{activeFilterCount}</Badge>
                )}
              </span>
              {filtersExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {filtersExpanded && (
              <div className="mt-4 space-y-4">
                {/* Game Type */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Game Type</p>
                  <div className="flex flex-wrap gap-1.5">
                    {GAME_TYPES.map(t => (
                      <PickerChip key={t} label={t} selected={selectedTypes.includes(t)} onClick={() => setSelectedTypes(prev => toggleArrayItem(prev, t))} />
                    ))}
                  </div>
                </div>

                {/* Mechanic */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Mechanic</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mechanicFamilyNames.map(m => (
                      <PickerChip key={m} label={m} selected={selectedMechanics.includes(m)} onClick={() => setSelectedMechanics(prev => toggleArrayItem(prev, m))} />
                    ))}
                  </div>
                </div>

                {/* Play Time */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Play Time</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PLAY_TIMES.map(pt => (
                      <PickerChip key={pt} label={pt} selected={selectedPlayTimes.includes(pt)} onClick={() => setSelectedPlayTimes(prev => toggleArrayItem(prev, pt))} />
                    ))}
                  </div>
                </div>

                {/* Player Count */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Player Count</p>
                  <Select value={playerCount} onValueChange={setPlayerCount}>
                    <SelectTrigger className="w-[160px] h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} Player{n !== 1 ? "s" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Random Picker */}
      <Card className="max-w-lg mx-auto border-primary/30">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            {spinning ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}>
                <Dice5 className="h-10 w-10 text-primary" />
              </motion.div>
            ) : (
              <Dice5 className="h-10 w-10 text-primary" />
            )}
          </div>

          {/* Animation preview */}
          {spinning && animatingGame && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50 animate-pulse">
              <div className="flex items-center gap-3 justify-center">
                <div className="w-10 h-10 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {animatingGame.image_url ? (
                    <img src={animatingGame.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Gamepad2 className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm font-medium truncate">{animatingGame.title}</p>
              </div>
            </div>
          )}

          {!pickedGame && !spinning && (
            <>
              <h3 className="font-display text-lg">Can't decide? Let us pick!</h3>
              <p className="text-sm text-muted-foreground">
                We'll randomly select from {availableGames.length} available game{availableGames.length !== 1 ? "s" : ""} matching your filters.
              </p>
              <Button onClick={handleSpin} size="lg" className="gap-2" disabled={availableGames.length === 0}>
                <Shuffle className="h-5 w-5" />
                Pick a Random Game
              </Button>
            </>
          )}

          {pickedGame && !spinning && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-3 overflow-hidden">
                  {pickedGame.image_url ? (
                    <img src={pickedGame.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Gamepad2 className="h-8 w-8 text-primary/60" />
                  )}
                </div>
                <h3 className="font-display text-xl text-primary">{pickedGame.title}</h3>
                <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground mt-2 flex-wrap">
                  {pickedGame.min_players != null && pickedGame.max_players != null && (
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{pickedGame.min_players}–{pickedGame.max_players}</span>
                  )}
                  {pickedGame.play_time_minutes != null && (
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{pickedGame.play_time_minutes}m</span>
                  )}
                  {pickedGame.game_type && (
                    <Badge variant="outline" className="text-xs">{pickedGame.game_type}</Badge>
                  )}
                </div>
                <Badge variant="secondary" className="mt-2">{pickedGame.available} of {pickedGame.copies_owned || 1} available</Badge>
              </div>

              {reservedGameId === pickedGame.id ? (
                <Card className="bg-primary/5 border-primary/20 text-left">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Reserved! Held for {conventionSettings?.reservation_hold_minutes || 30} minutes.
                    </p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>🎫 Show this screen to a volunteer at the lending desk</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => { setPickedGame(null); setReservedGameId(null); setReservationId(null); }}>
                        Browse More Games
                      </Button>
                      {reservationId && (
                        <Button variant="ghost" size="sm" className="text-destructive gap-1" onClick={() => cancelReservation.mutate(reservationId)} disabled={cancelReservation.isPending}>
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => handleReserve(pickedGame.id)}
                    className="gap-2"
                    disabled={createReservation.isPending}
                  >
                    {createReservation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                    Reserve This Game
                  </Button>
                  <Button variant="outline" onClick={handleSpin} className="gap-2">
                    <Shuffle className="h-4 w-4" /> Pick Another
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Browse Available */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Browse Available Games
          </h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search games..." className="pl-9 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {filteredGames.slice(0, 20).map((game: any) => (
            <Card key={game.id} className={`overflow-hidden ${game.available > 0 ? "card-hover cursor-pointer" : "opacity-60 border-dashed"}`}>
              <div className="aspect-square bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center relative overflow-hidden">
                {game.image_url ? (
                  <img src={game.image_url} alt={game.title} className="w-full h-full object-cover" />
                ) : (
                  <Gamepad2 className={`h-12 w-12 ${game.available > 0 ? "text-primary/40" : "text-muted-foreground/20"}`} />
                )}
                {game.available === 0 && (
                  <Badge className="absolute top-2 right-2 bg-destructive/80 text-destructive-foreground text-xs">
                    All out
                  </Badge>
                )}
              </div>
              <CardContent className="p-2.5">
                <p className="font-display font-medium text-sm truncate">{game.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  {game.min_players != null && <span>{game.min_players}–{game.max_players}p</span>}
                  {game.play_time_minutes != null && <><span>·</span><span>{game.play_time_minutes}m</span></>}
                </div>
                {game.available > 0 ? (
                  <Button
                    size="sm"
                    variant={reservedGameId === game.id ? "secondary" : "outline"}
                    className="w-full mt-2 text-xs h-7 gap-1"
                    onClick={() => handleReserve(game.id)}
                    disabled={createReservation.isPending || reservedGameId === game.id}
                  >
                    {reservedGameId === game.id ? (
                      <><CheckCircle className="h-3 w-3" /> Reserved</>
                    ) : (
                      <><CalendarClock className="h-3 w-3" /> Reserve</>
                    )}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="w-full mt-2 text-xs h-7 gap-1" disabled>
                    Unavailable
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredGames.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No games match your filters</p>
        )}
      </div>
    </div>
  );
}
