import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTenantUrl } from "@/hooks/useTenantUrl";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { 
  useGame, 
  useAllGamesFlat,
  useMechanics, 
  usePublishers, 
  useDesigners,
  useArtists,
  useCreateGame, 
  useUpdateGame,
  useCreateMechanic,
  useCreatePublisher,
  useCreateDesigner,
  useCreateArtist
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
  SALE_CONDITION_OPTIONS,
  type DifficultyLevel,
  type GameType,
  type PlayTime,
  type SaleCondition
} from "@/types/game";
import { YouTubeVideoEditor } from "@/components/games/YouTubeEmbed";

const GameForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { buildUrl } = useTenantUrl();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: existingGame, isLoading: gameLoading } = useGame(id);
  const { data: mechanics = [] } = useMechanics();
  const { data: publishers = [] } = usePublishers();
  const { data: designers = [] } = useDesigners();
  const { data: artists = [] } = useArtists();
  const { data: baseGames = [] } = useAllGamesFlat();
  const createGame = useCreateGame();
  const updateGame = useUpdateGame();
  const createMechanic = useCreateMechanic();
  const createPublisher = useCreatePublisher();
  const createDesigner = useCreateDesigner();
  const createArtist = useCreateArtist();
  const { toast } = useToast();

  const isEditing = !!id;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("3 - Medium");
  const [gameType, setGameType] = useState<GameType>("Board Game");
  const [genre, setGenre] = useState<string>("");
  const [playTime, setPlayTime] = useState<PlayTime>("45-60 Minutes");
  const [minPlayers, setMinPlayers] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [suggestedAge, setSuggestedAge] = useState("10+");
  const [publisherId, setPublisherId] = useState<string | null>(null);
  const [selectedMechanics, setSelectedMechanics] = useState<string[]>([]);
  const [originalMechanics, setOriginalMechanics] = useState<string[]>([]); // Track original for comparison
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
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [sleeved, setSleeved] = useState(false);
  const [upgradedComponents, setUpgradedComponents] = useState(false);
  const [crowdfunded, setCrowdfunded] = useState(false);
  const [inserts, setInserts] = useState(false);
  const [isUnplayed, setIsUnplayed] = useState(false);
  const [newMechanic, setNewMechanic] = useState("");
  const [newPublisher, setNewPublisher] = useState("");
  const [newDesigner, setNewDesigner] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [selectedDesigners, setSelectedDesigners] = useState<string[]>([]);
  const [originalDesigners, setOriginalDesigners] = useState<string[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [originalArtists, setOriginalArtists] = useState<string[]>([]);
  const [youtubeVideos, setYoutubeVideos] = useState<string[]>([]);
  const [copiesOwned, setCopiesOwned] = useState(1);
  const [mechanicSearch, setMechanicSearch] = useState("");
  const [designerSearch, setDesignerSearch] = useState("");
  const [artistSearch, setArtistSearch] = useState("");
  const [parentGameSearch, setParentGameSearch] = useState("");

  // Filter out current game from parent options (can't be its own parent)
  const parentGameOptions = useMemo(
    () => baseGames.filter((g) => g.id !== id),
    [baseGames, id]
  );

  const filteredMechanics = useMemo(
    () => mechanicSearch
      ? mechanics.filter(m => m.name.toLowerCase().includes(mechanicSearch.toLowerCase()))
      : mechanics,
    [mechanics, mechanicSearch]
  );

  const filteredDesigners = useMemo(
    () => designerSearch
      ? designers.filter(d => d.name.toLowerCase().includes(designerSearch.toLowerCase()))
      : designers,
    [designers, designerSearch]
  );

  const filteredArtists = useMemo(
    () => artistSearch
      ? artists.filter(a => a.name.toLowerCase().includes(artistSearch.toLowerCase()))
      : artists,
    [artists, artistSearch]
  );

  const filteredParentGames = useMemo(
    () => parentGameSearch
      ? parentGameOptions.filter(g => g.title.toLowerCase().includes(parentGameSearch.toLowerCase()))
      : parentGameOptions.slice(0, 50),
    [parentGameOptions, parentGameSearch]
  );

  // Load existing game data
  useEffect(() => {
    if (existingGame) {
      setTitle(existingGame.title);
      setDescription(existingGame.description || "");
      setImageUrl(existingGame.image_url || "");
      setDifficulty(existingGame.difficulty);
      setGameType(existingGame.game_type);
      setGenre((existingGame as any).genre || "");
      setPlayTime(existingGame.play_time);
      setMinPlayers(existingGame.min_players);
      setMaxPlayers(existingGame.max_players);
      setSuggestedAge(existingGame.suggested_age);
      setPublisherId(existingGame.publisher_id);
      const mechanicIds = existingGame.mechanics.map((m) => m.id);
      setSelectedMechanics(mechanicIds);
      setOriginalMechanics(mechanicIds);
      const designerIds = (existingGame.designers || []).map((d: any) => d.id);
      setSelectedDesigners(designerIds);
      setOriginalDesigners(designerIds);
      const artistIds = (existingGame.artists || []).map((a: any) => a.id);
      setSelectedArtists(artistIds);
      setOriginalArtists(artistIds);
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
      setPurchasePrice(existingGame.admin_data?.purchase_price?.toString() || "");
      setPurchaseDate(existingGame.admin_data?.purchase_date || "");
      setCurrentValue((existingGame.admin_data as any)?.current_value?.toString() || "");
      setSleeved(existingGame.sleeved || false);
      setUpgradedComponents(existingGame.upgraded_components || false);
      setCrowdfunded(existingGame.crowdfunded || false);
      setInserts(existingGame.inserts || false);
      setIsUnplayed((existingGame as any).is_unplayed || false);
      setYoutubeVideos(existingGame.youtube_videos || []);
      setCopiesOwned((existingGame as any).copies_owned ?? 1);
    }
  }, [existingGame]);

  // Redirect if not authenticated
  if (!authLoading && !isAuthenticated) {
    navigate("/admin");
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

  const handleDesignerToggle = (designerId: string) => {
    setSelectedDesigners((prev) =>
      prev.includes(designerId)
        ? prev.filter((id) => id !== designerId)
        : [...prev, designerId]
    );
  };

  const handleAddDesigner = async () => {
    if (!newDesigner.trim()) return;
    try {
      const d = await createDesigner.mutateAsync(newDesigner.trim());
      setSelectedDesigners((prev) => [...prev, d.id]);
      setNewDesigner("");
      toast({ title: "Designer added" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleArtistToggle = (artistId: string) => {
    setSelectedArtists((prev) =>
      prev.includes(artistId)
        ? prev.filter((id) => id !== artistId)
        : [...prev, artistId]
    );
  };

  const handleAddArtist = async () => {
    if (!newArtist.trim()) return;
    try {
      const a = await createArtist.mutateAsync(newArtist.trim());
      setSelectedArtists((prev) => [...prev, a.id]);
      setNewArtist("");
      toast({ title: "Artist added" });
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
      genre: genre.trim() || null,
      play_time: playTime,
      min_players: minPlayers,
      max_players: maxPlayers,
      suggested_age: suggestedAge,
      publisher_id: publisherId,
      bgg_id: null,
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
      purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
      purchase_date: purchaseDate || null,
      current_value: currentValue ? parseFloat(currentValue) : null,
      sleeved,
      upgraded_components: upgradedComponents,
      crowdfunded,
      inserts,
      is_unplayed: isUnplayed,
      youtube_videos: youtubeVideos,
      copies_owned: copiesOwned,
    };

    try {
      if (isEditing && existingGame?.id) {
        // Only pass mechanicIds if they changed (avoid unnecessary RLS checks)
        const mechanicsChanged = 
          selectedMechanics.length !== originalMechanics.length ||
          selectedMechanics.some(id => !originalMechanics.includes(id)) ||
          originalMechanics.some(id => !selectedMechanics.includes(id));
        const designersChanged = 
          selectedDesigners.length !== originalDesigners.length ||
          selectedDesigners.some(id => !originalDesigners.includes(id)) ||
          originalDesigners.some(id => !selectedDesigners.includes(id));
        const artistsChanged = 
          selectedArtists.length !== originalArtists.length ||
          selectedArtists.some(id => !originalArtists.includes(id)) ||
          originalArtists.some(id => !selectedArtists.includes(id));
        
        await updateGame.mutateAsync({
          id: existingGame.id,
          game: gameData,
          mechanicIds: mechanicsChanged ? selectedMechanics : undefined,
          designerIds: designersChanged ? selectedDesigners : undefined,
          artistIds: artistsChanged ? selectedArtists : undefined,
        });
        toast({ title: "Game updated!" });
      } else {
        await createGame.mutateAsync({
          game: gameData,
          mechanicIds: selectedMechanics,
          designerIds: selectedDesigners,
          artistIds: selectedArtists,
        });
        toast({ title: "Game created!" });
      }
      navigate(buildUrl("/manage"));
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
        <Button variant="ghost" className="mb-6 -ml-2" onClick={() => navigate(buildUrl("/manage"))}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Manage
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
                  <Label>Genre</Label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fantasy">Fantasy</SelectItem>
                      <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                      <SelectItem value="Historical">Historical</SelectItem>
                      <SelectItem value="Horror">Horror</SelectItem>
                      <SelectItem value="Mystery">Mystery</SelectItem>
                      <SelectItem value="Adventure">Adventure</SelectItem>
                      <SelectItem value="Economic">Economic</SelectItem>
                      <SelectItem value="Abstract">Abstract</SelectItem>
                      <SelectItem value="Humor">Humor</SelectItem>
                      <SelectItem value="Nature">Nature</SelectItem>
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
                      Mark this as an expansion. It will be nested under its base game in the collection.
                    </p>
                  </div>
                </div>

                {/* Parent Game Selection - Only show when Expansion is checked */}
                {isExpansion && (
                  <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
                    <div className="space-y-2">
                      <Label>Base Game</Label>
                      <Input
                        value={parentGameSearch}
                        onChange={(e) => setParentGameSearch(e.target.value)}
                        placeholder="Search base games..."
                        className="mb-2"
                      />
                      <Select value={parentGameId || ""} onValueChange={setParentGameId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select the base game" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredParentGames.map((g) => (
                            <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Select which game this is an expansion for.
                      </p>
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

              {/* Copies Owned */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Inventory</h3>
                <div className="p-4 rounded-lg border border-border bg-muted/50">
                  <div className="space-y-2">
                    <Label htmlFor="copiesOwned">Copies Owned</Label>
                    <Input
                      id="copiesOwned"
                      type="number"
                      min={1}
                      value={copiesOwned}
                      onChange={(e) => setCopiesOwned(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Track how many copies of this game you own. Used for lending inventory.
                    </p>
                  </div>
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
                      Mark this game as available for sale. It will appear in the marketplace section.
                    </p>
                  </div>
                </div>

                {/* Sale Details - Only show when For Sale is checked */}
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

              {/* Location */}
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
                <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg border border-border bg-muted/50">
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
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="isUnplayed"
                      checked={isUnplayed}
                      onCheckedChange={(checked) => setIsUnplayed(checked === true)}
                    />
                    <label htmlFor="isUnplayed" className="text-sm font-medium cursor-pointer">
                      Unplayed
                    </label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Track where this game is stored and its component status.</p>

              </div>

              {/* Purchase Info (Admin Only) */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Purchase Information</h3>
                <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">Purchase Date</Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="currentValue">Current Market Value ($)</Label>
                    <Input
                      id="currentValue"
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentValue}
                      onChange={(e) => setCurrentValue(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your estimated resale value — used for collection value tracking.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Private purchase tracking - only visible to admins.
                </p>
              </div>

              {/* YouTube Videos */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Gameplay Videos</h3>
                <div className="p-4 rounded-lg border border-border bg-muted/50">
                  <YouTubeVideoEditor videos={youtubeVideos} onChange={setYoutubeVideos} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Add YouTube links to gameplay videos, reviews, or tutorials.
                </p>
              </div>

              {/* Mechanics */}
              <div className="space-y-3">
                <Label>Mechanics</Label>
                <Input
                  value={mechanicSearch}
                  onChange={(e) => setMechanicSearch(e.target.value)}
                  placeholder="Search mechanics..."
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {filteredMechanics.map((m) => (
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
                {selectedMechanics.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedMechanics.length} selected</p>
                )}
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

              {/* Designers */}
              <div className="space-y-3">
                <Label>Designers</Label>
                <Input
                  value={designerSearch}
                  onChange={(e) => setDesignerSearch(e.target.value)}
                  placeholder="Search designers..."
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {filteredDesigners.map((d) => (
                    <div key={d.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`designer-${d.id}`}
                        checked={selectedDesigners.includes(d.id)}
                        onCheckedChange={() => handleDesignerToggle(d.id)}
                      />
                      <label htmlFor={`designer-${d.id}`} className="text-sm cursor-pointer">
                        {d.name}
                      </label>
                    </div>
                  ))}
                </div>
                {selectedDesigners.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedDesigners.length} selected</p>
                )}
                <div className="flex gap-2">
                  <Input
                    value={newDesigner}
                    onChange={(e) => setNewDesigner(e.target.value)}
                    placeholder="Add new designer"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleAddDesigner}>
                    Add
                  </Button>
                </div>
              </div>

              {/* Artists */}
              <div className="space-y-3">
                <Label>Artists</Label>
                <Input
                  value={artistSearch}
                  onChange={(e) => setArtistSearch(e.target.value)}
                  placeholder="Search artists..."
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {filteredArtists.map((a) => (
                    <div key={a.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`artist-${a.id}`}
                        checked={selectedArtists.includes(a.id)}
                        onCheckedChange={() => handleArtistToggle(a.id)}
                      />
                      <label htmlFor={`artist-${a.id}`} className="text-sm cursor-pointer">
                        {a.name}
                      </label>
                    </div>
                  ))}
                </div>
                {selectedArtists.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedArtists.length} selected</p>
                )}
                <div className="flex gap-2">
                  <Input
                    value={newArtist}
                    onChange={(e) => setNewArtist(e.target.value)}
                    placeholder="Add new artist"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleAddArtist}>
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
