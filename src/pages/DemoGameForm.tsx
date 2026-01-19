import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useDemoMode } from "@/contexts/DemoContext";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { 
  DIFFICULTY_OPTIONS, 
  GAME_TYPE_OPTIONS, 
  PLAY_TIME_OPTIONS,
  SALE_CONDITION_OPTIONS,
  type DifficultyLevel,
  type GameType,
  type PlayTime,
  type SaleCondition
} from "@/types/game";

const DemoGameForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDemoMode, demoGames, addDemoGame, updateDemoGame } = useDemoMode();

  const isEditing = !!id;
  const existingGame = useMemo(() => demoGames.find(g => g.id === id), [demoGames, id]);

  // Derive mechanics and publishers from demo games
  const mechanics = useMemo(() => {
    const mechMap = new Map<string, { id: string; name: string }>();
    demoGames.forEach(g => {
      g.mechanics.forEach(m => mechMap.set(m.id, m));
    });
    return Array.from(mechMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [demoGames]);

  const publishers = useMemo(() => {
    const pubMap = new Map<string, { id: string; name: string }>();
    demoGames.forEach(g => {
      if (g.publisher) pubMap.set(g.publisher.id, g.publisher);
    });
    return Array.from(pubMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [demoGames]);

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
  const [isForSale, setIsForSale] = useState(false);
  const [salePrice, setSalePrice] = useState<string>("");
  const [saleCondition, setSaleCondition] = useState<SaleCondition | null>(null);
  const [isExpansion, setIsExpansion] = useState(false);
  const [parentGameId, setParentGameId] = useState<string | null>(null);
  const [inBaseGameBox, setInBaseGameBox] = useState(false);
  const [locationRoom, setLocationRoom] = useState("");
  const [locationShelf, setLocationShelf] = useState("");
  const [locationMisc, setLocationMisc] = useState("");
  const [sleeved, setSleeved] = useState(false);
  const [upgradedComponents, setUpgradedComponents] = useState(false);
  const [crowdfunded, setCrowdfunded] = useState(false);
  const [inserts, setInserts] = useState(false);

  // Filter out current game from parent options
  const parentGameOptions = demoGames.filter((g) => g.id !== id && !g.is_expansion);

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
      setIsForSale(existingGame.is_for_sale);
      setSalePrice(existingGame.sale_price?.toString() || "");
      setSaleCondition(existingGame.sale_condition);
      setIsExpansion(existingGame.is_expansion);
      setParentGameId(existingGame.parent_game_id);
      setInBaseGameBox(existingGame.in_base_game_box || false);
      setLocationRoom(existingGame.location_room || "");
      setLocationShelf(existingGame.location_shelf || "");
      setLocationMisc(existingGame.location_misc || "");
      setSleeved(existingGame.sleeved || false);
      setUpgradedComponents(existingGame.upgraded_components || false);
      setCrowdfunded(existingGame.crowdfunded || false);
      setInserts(existingGame.inserts || false);
    }
  }, [existingGame]);

  if (!isDemoMode) {
    navigate("/");
    return null;
  }

  const handleMechanicToggle = (mechanicId: string) => {
    setSelectedMechanics((prev) =>
      prev.includes(mechanicId)
        ? prev.filter((id) => id !== mechanicId)
        : [...prev, mechanicId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }

    const selectedPublisher = publishers.find(p => p.id === publisherId);
    const selectedMechanicObjects = mechanics.filter(m => selectedMechanics.includes(m.id));

    const gameData = {
      title: title.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      difficulty,
      game_type: gameType,
      play_time: playTime,
      min_players: minPlayers,
      max_players: maxPlayers,
      suggested_age: suggestedAge,
      publisher_id: publisherId,
      publisher: selectedPublisher || null,
      mechanics: selectedMechanicObjects,
      bgg_url: bggUrl.trim() || null,
      is_coming_soon: isComingSoon,
      is_for_sale: isForSale,
      sale_price: isForSale && salePrice ? parseFloat(salePrice) : null,
      sale_condition: isForSale ? saleCondition : null,
      is_expansion: isExpansion,
      parent_game_id: isExpansion ? parentGameId : null,
      in_base_game_box: isExpansion ? inBaseGameBox : false,
      location_room: locationRoom.trim() || null,
      location_shelf: locationShelf.trim() || null,
      location_misc: locationMisc.trim() || null,
      sleeved,
      upgraded_components: upgradedComponents,
      crowdfunded,
      inserts,
      slug: title.trim().toLowerCase().replace(/\s+/g, "-"),
    };

    if (isEditing && id) {
      updateDemoGame(id, gameData);
      toast({ title: "Game updated (Demo)" });
    } else {
      addDemoGame(gameData);
      toast({ title: "Game created (Demo)" });
    }
    navigate("/demo/settings");
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Demo Mode Banner */}
        <Alert className="border-amber-500/50 bg-amber-500/10 mb-6">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400">Demo Mode</AlertTitle>
          <AlertDescription className="text-amber-600/80 dark:text-amber-400/80">
            Changes made here are temporary and won't affect any real data.
          </AlertDescription>
        </Alert>

        <Button variant="ghost" className="mb-6 -ml-2" onClick={() => navigate("/demo/settings")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Demo Admin
        </Button>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {isEditing ? "Edit Game (Demo)" : "Add New Game (Demo)"}
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

              {/* Mechanics */}
              <div className="space-y-2">
                <Label>Mechanics</Label>
                <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-muted/30">
                  {mechanics.map((mech) => (
                    <label
                      key={mech.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-colors ${
                        selectedMechanics.includes(mech.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selectedMechanics.includes(mech.id)}
                        onChange={() => handleMechanicToggle(mech.id)}
                      />
                      <span className="text-sm">{mech.name}</span>
                    </label>
                  ))}
                  {mechanics.length === 0 && (
                    <p className="text-sm text-muted-foreground">No mechanics available</p>
                  )}
                </div>
              </div>

              {/* Expansion Toggle */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-4 rounded-lg border border-border bg-muted/50">
                  <Checkbox
                    id="isExpansion"
                    checked={isExpansion}
                    onCheckedChange={(checked) => {
                      setIsExpansion(checked === true);
                      if (!checked) {
                        setParentGameId(null);
                        setInBaseGameBox(false);
                      }
                    }}
                  />
                  <div className="space-y-1">
                    <label htmlFor="isExpansion" className="text-sm font-medium cursor-pointer">
                      This is an Expansion
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Mark this as an expansion for a base game.
                    </p>
                  </div>
                </div>

                {isExpansion && (
                  <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
                    <div className="space-y-2">
                      <Label>Base Game</Label>
                      <Select value={parentGameId || ""} onValueChange={setParentGameId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select the base game" />
                        </SelectTrigger>
                        <SelectContent>
                          {parentGameOptions.map((g) => (
                            <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="inBaseGameBox"
                        checked={inBaseGameBox}
                        onCheckedChange={(checked) => setInBaseGameBox(checked === true)}
                      />
                      <label htmlFor="inBaseGameBox" className="text-sm font-medium cursor-pointer">
                        Stored in base game box
                      </label>
                    </div>
                  </div>
                )}
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
                    Mark this game as not yet in the collection.
                  </p>
                </div>
              </div>

              {/* For Sale Toggle */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-4 rounded-lg border border-border bg-muted/50">
                  <Checkbox
                    id="isForSale"
                    checked={isForSale}
                    onCheckedChange={(checked) => setIsForSale(checked === true)}
                  />
                  <div className="space-y-1">
                    <label htmlFor="isForSale" className="text-sm font-medium cursor-pointer">
                      For Sale
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Mark this game as available for purchase.
                    </p>
                  </div>
                </div>

                {isForSale && (
                  <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="space-y-2">
                      <Label htmlFor="salePrice">Price ($)</Label>
                      <Input
                        id="salePrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Condition</Label>
                      <Select 
                        value={saleCondition || ""} 
                        onValueChange={(v) => setSaleCondition(v as SaleCondition)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          {SALE_CONDITION_OPTIONS.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Storage Location */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Storage Location</h3>
                <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg border border-border bg-muted/50">
                  <div className="space-y-2">
                    <Label htmlFor="locationRoom">Room</Label>
                    <Select value={locationRoom} onValueChange={setLocationRoom}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select room" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="Living Room">Living Room</SelectItem>
                        <SelectItem value="Family Room">Family Room</SelectItem>
                        <SelectItem value="Game Room">Game Room</SelectItem>
                        <SelectItem value="Den">Den</SelectItem>
                        <SelectItem value="Basement">Basement</SelectItem>
                        <SelectItem value="Bedroom">Bedroom</SelectItem>
                        <SelectItem value="Office">Office</SelectItem>
                        <SelectItem value="Closet">Closet</SelectItem>
                        <SelectItem value="Attic">Attic</SelectItem>
                        <SelectItem value="Garage">Garage</SelectItem>
                        <SelectItem value="Dining Room">Dining Room</SelectItem>
                        <SelectItem value="Storage Room">Storage Room</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locationShelf">Shelf</Label>
                    <Input
                      id="locationShelf"
                      value={locationShelf}
                      onChange={(e) => setLocationShelf(e.target.value)}
                      placeholder="e.g., Shelf A, Top Shelf"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="locationMisc">Additional Location Notes</Label>
                    <Input
                      id="locationMisc"
                      value={locationMisc}
                      onChange={(e) => setLocationMisc(e.target.value)}
                      placeholder="e.g., In closet, Behind couch, etc."
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3 p-4 rounded-lg border border-border bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="sleeved"
                      checked={sleeved}
                      onCheckedChange={(checked) => setSleeved(checked === true)}
                    />
                    <label htmlFor="sleeved" className="text-sm font-medium cursor-pointer">
                      Sleeved
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="upgradedComponents"
                      checked={upgradedComponents}
                      onCheckedChange={(checked) => setUpgradedComponents(checked === true)}
                    />
                    <label htmlFor="upgradedComponents" className="text-sm font-medium cursor-pointer">
                      Upgraded Components
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="crowdfunded"
                      checked={crowdfunded}
                      onCheckedChange={(checked) => setCrowdfunded(checked === true)}
                    />
                    <label htmlFor="crowdfunded" className="text-sm font-medium cursor-pointer">
                      Crowdfunded
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="inserts"
                      checked={inserts}
                      onCheckedChange={(checked) => setInserts(checked === true)}
                    />
                    <label htmlFor="inserts" className="text-sm font-medium cursor-pointer">
                      Inserts
                    </label>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? "Update Game" : "Create Game"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/demo/settings")}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DemoGameForm;
