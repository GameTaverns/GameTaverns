import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { 
  useGame, 
  useMechanics, 
  usePublishers, 
  useCreateGame, 
  useUpdateGame,
  useCreateMechanic,
  useCreatePublisher
} from "@/hooks/useGames";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  DIFFICULTY_OPTIONS, 
  GAME_TYPE_OPTIONS, 
  PLAY_TIME_OPTIONS,
  type DifficultyLevel,
  type GameType,
  type PlayTime
} from "@/types/game";

const GameForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: existingGame, isLoading: gameLoading } = useGame(id);
  const { data: mechanics = [] } = useMechanics();
  const { data: publishers = [] } = usePublishers();
  const createGame = useCreateGame();
  const updateGame = useUpdateGame();
  const createMechanic = useCreateMechanic();
  const createPublisher = useCreatePublisher();
  const { toast } = useToast();

  const isEditing = !!id;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("3 - Medium");
  const [gameType, setGameType] = useState<GameType>("Board Game");
  const [playTime, setPlayTime] = useState<PlayTime>("45-60 Minutes");
  const [minPlayers, setMinPlayers] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [suggestedAge, setSuggestedAge] = useState("10+");
  const [publisherId, setPublisherId] = useState<string | null>(null);
  const [selectedMechanics, setSelectedMechanics] = useState<string[]>([]);
  const [bggUrl, setBggUrl] = useState("");
  const [isComingSoon, setIsComingSoon] = useState(false);
  const [newMechanic, setNewMechanic] = useState("");
  const [newPublisher, setNewPublisher] = useState("");

  // Load existing game data
  useEffect(() => {
    if (existingGame) {
      setTitle(existingGame.title);
      setDescription(existingGame.description || "");
      setImageUrl(existingGame.image_url || "");
      setDifficulty(existingGame.difficulty);
      setGameType(existingGame.game_type);
      setPlayTime(existingGame.play_time);
      setMinPlayers(existingGame.min_players);
      setMaxPlayers(existingGame.max_players);
      setSuggestedAge(existingGame.suggested_age);
      setPublisherId(existingGame.publisher_id);
      setSelectedMechanics(existingGame.mechanics.map((m) => m.id));
      setBggUrl(existingGame.bgg_url || "");
      setIsComingSoon(existingGame.is_coming_soon);
    }
  }, [existingGame]);

  // Redirect if not authenticated
  if (!authLoading && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  const handleMechanicToggle = (mechanicId: string) => {
    setSelectedMechanics((prev) =>
      prev.includes(mechanicId)
        ? prev.filter((id) => id !== mechanicId)
        : [...prev, mechanicId]
    );
  };

  const handleAddMechanic = async () => {
    if (!newMechanic.trim()) return;
    try {
      const mech = await createMechanic.mutateAsync(newMechanic.trim());
      setSelectedMechanics((prev) => [...prev, mech.id]);
      setNewMechanic("");
      toast({ title: "Mechanic added" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAddPublisher = async () => {
    if (!newPublisher.trim()) return;
    try {
      const pub = await createPublisher.mutateAsync(newPublisher.trim());
      setPublisherId(pub.id);
      setNewPublisher("");
      toast({ title: "Publisher added" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }

    const gameData = {
      title: title.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      additional_images: [],
      difficulty,
      game_type: gameType,
      play_time: playTime,
      min_players: minPlayers,
      max_players: maxPlayers,
      suggested_age: suggestedAge,
      publisher_id: publisherId,
      bgg_id: null,
      bgg_url: bggUrl.trim() || null,
      is_coming_soon: isComingSoon,
    };

    try {
      if (isEditing && id) {
        await updateGame.mutateAsync({
          id,
          game: gameData,
          mechanicIds: selectedMechanics,
        });
        toast({ title: "Game updated!" });
      } else {
        await createGame.mutateAsync({
          game: gameData,
          mechanicIds: selectedMechanics,
        });
        toast({ title: "Game created!" });
      }
      navigate("/admin");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const isLoading = authLoading || (isEditing && gameLoading);
  const isSaving = createGame.isPending || updateGame.isPending;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" className="mb-6 -ml-2" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {isEditing ? "Edit Game" : "Add New Game"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Game title"
                    required
                  />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Game description..."
                    rows={4}
                  />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as DifficultyLevel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTY_OPTIONS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Game Type</Label>
                  <Select value={gameType} onValueChange={(v) => setGameType(v as GameType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GAME_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Play Time</Label>
                  <Select value={playTime} onValueChange={(v) => setPlayTime(v as PlayTime)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAY_TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Publisher</Label>
                  <Select value={publisherId || ""} onValueChange={setPublisherId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select publisher" />
                    </SelectTrigger>
                    <SelectContent>
                      {publishers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minPlayers">Min Players</Label>
                  <Input
                    id="minPlayers"
                    type="number"
                    min={1}
                    value={minPlayers}
                    onChange={(e) => setMinPlayers(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxPlayers">Max Players</Label>
                  <Input
                    id="maxPlayers"
                    type="number"
                    min={1}
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="age">Suggested Age</Label>
                  <Input
                    id="age"
                    value={suggestedAge}
                    onChange={(e) => setSuggestedAge(e.target.value)}
                    placeholder="10+"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bggUrl">BoardGameGeek URL</Label>
                  <Input
                    id="bggUrl"
                    type="url"
                    value={bggUrl}
                    onChange={(e) => setBggUrl(e.target.value)}
                    placeholder="https://boardgamegeek.com/boardgame/..."
                  />
                </div>
              </div>

              {/* Coming Soon Toggle */}
              <div className="flex items-center space-x-3 p-4 rounded-lg border border-border bg-muted/50">
                <Checkbox
                  id="isComingSoon"
                  checked={isComingSoon}
                  onCheckedChange={(checked) => setIsComingSoon(checked === true)}
                />
                <div className="space-y-1">
                  <label htmlFor="isComingSoon" className="text-sm font-medium cursor-pointer">
                    Coming Soon
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Mark this game as purchased/backed but not yet received. It won't appear in the main catalog.
                  </p>
                </div>
              </div>

              {/* Mechanics */}
              <div className="space-y-3">
                <Label>Mechanics</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {mechanics.map((m) => (
                    <div key={m.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`mech-${m.id}`}
                        checked={selectedMechanics.includes(m.id)}
                        onCheckedChange={() => handleMechanicToggle(m.id)}
                      />
                      <label htmlFor={`mech-${m.id}`} className="text-sm cursor-pointer">
                        {m.name}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newMechanic}
                    onChange={(e) => setNewMechanic(e.target.value)}
                    placeholder="Add new mechanic"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleAddMechanic}>
                    Add
                  </Button>
                </div>
              </div>

              {/* New Publisher */}
              <div className="space-y-2">
                <Label>Add New Publisher</Label>
                <div className="flex gap-2">
                  <Input
                    value={newPublisher}
                    onChange={(e) => setNewPublisher(e.target.value)}
                    placeholder="Publisher name"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleAddPublisher}>
                    Add
                  </Button>
                </div>
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditing ? "Update Game" : "Create Game"}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default GameForm;
