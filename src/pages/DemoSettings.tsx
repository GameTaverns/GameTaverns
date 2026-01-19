import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Shield, 
  Plus, 
  Trash2, 
  Edit, 
  ArrowLeft,
  Settings as SettingsIcon,
  Tag,
  Building,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  Eye,
  Upload,
  Loader2,
  MapPin,
  DollarSign,
  FileSpreadsheet
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useDemoMode } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkImportDialog } from "@/components/games/BulkImportDialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { GameWithRelations } from "@/types/game";
import { SALE_CONDITION_OPTIONS, type SaleCondition } from "@/types/game";

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface GameCollectionTableProps {
  games: GameWithRelations[];
  filterLetter: string | null;
  setFilterLetter: (letter: string | null) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  gamesPerPage: number;
  onEdit: (id: string) => void;
  onDelete: (id: string, title: string) => void;
}

function GameCollectionTable({
  games,
  filterLetter,
  setFilterLetter,
  currentPage,
  setCurrentPage,
  gamesPerPage,
  onEdit,
  onDelete,
}: GameCollectionTableProps) {
  const filteredGames = useMemo(() => {
    let result = [...games].sort((a, b) => a.title.localeCompare(b.title));
    if (filterLetter) {
      result = result.filter(g => g.title.toUpperCase().startsWith(filterLetter));
    }
    return result;
  }, [games, filterLetter]);

  const totalPages = Math.ceil(filteredGames.length / gamesPerPage);
  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * gamesPerPage;
    return filteredGames.slice(start, start + gamesPerPage);
  }, [filteredGames, currentPage, gamesPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterLetter, setCurrentPage]);

  const lettersWithGames = useMemo(() => {
    const letters = new Set<string>();
    games.forEach(g => {
      const firstLetter = g.title.charAt(0).toUpperCase();
      if (ALPHABET.includes(firstLetter)) {
        letters.add(firstLetter);
      }
    });
    return letters;
  }, [games]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 p-2 bg-muted/50 rounded-lg">
        <Button
          variant={filterLetter === null ? "default" : "ghost"}
          size="sm"
          className="h-8 px-2 text-xs font-medium"
          onClick={() => setFilterLetter(null)}
        >
          All
        </Button>
        {ALPHABET.map(letter => {
          const hasGames = lettersWithGames.has(letter);
          return (
            <Button
              key={letter}
              variant={filterLetter === letter ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0 text-xs font-medium"
              onClick={() => setFilterLetter(letter)}
              disabled={!hasGames}
            >
              {letter}
            </Button>
          );
        })}
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {paginatedGames.length} of {filteredGames.length} games
        {filterLetter && ` starting with "${filterLetter}"`}
      </div>

      {paginatedGames.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No games found{filterLetter ? ` starting with "${filterLetter}"` : ''}.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Players</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedGames.map((game) => (
              <TableRow key={game.id}>
                <TableCell className="font-medium">{game.title}</TableCell>
                <TableCell>{game.game_type}</TableCell>
                <TableCell>{game.difficulty}</TableCell>
                <TableCell>
                  {game.min_players}-{game.max_players}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(game.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Game (Demo)</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove "{game.title}" from the demo data. This won't affect any real data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(game.id, game.title)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

const DemoSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDemoMode, demoGames, addDemoGame, deleteDemoGame, resetDemoData } = useDemoMode();

  const [gameFilterLetter, setGameFilterLetter] = useState<string | null>(null);
  const [gameCurrentPage, setGameCurrentPage] = useState(1);
  const GAMES_PER_PAGE = 20;

  // Import state
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importAsComingSoon, setImportAsComingSoon] = useState(false);
  const [importAsForSale, setImportAsForSale] = useState(false);
  const [importAsExpansion, setImportAsExpansion] = useState(false);
  const [importParentGameId, setImportParentGameId] = useState<string | null>(null);
  const [importSalePrice, setImportSalePrice] = useState("");
  const [importSaleCondition, setImportSaleCondition] = useState<SaleCondition | null>(null);
  const [importLocationRoom, setImportLocationRoom] = useState("");
  const [importLocationShelf, setImportLocationShelf] = useState("");
  const [importLocationMisc, setImportLocationMisc] = useState("");
  const [importPurchasePrice, setImportPurchasePrice] = useState("");
  const [importPurchaseDate, setImportPurchaseDate] = useState("");
  const [importSleeved, setImportSleeved] = useState(false);
  const [importUpgradedComponents, setImportUpgradedComponents] = useState(false);
  const [importCrowdfunded, setImportCrowdfunded] = useState(false);
  const [importInserts, setImportInserts] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  // Demo mechanics and publishers derived from games
  // Dedupe by name since imported games may have different IDs for the same mechanic
  const mechanics = useMemo(() => {
    const mechMap = new Map<string, { id: string; name: string }>();
    demoGames.forEach(g => {
      g.mechanics.forEach(m => mechMap.set(m.name, m));
    });
    return Array.from(mechMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [demoGames]);

  // Dedupe by name since imported games may have different IDs for the same publisher
  const publishers = useMemo(() => {
    const pubMap = new Map<string, { id: string; name: string }>();
    demoGames.forEach(g => {
      if (g.publisher) pubMap.set(g.publisher.name, g.publisher);
    });
    return Array.from(pubMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [demoGames]);

  // Filter out expansions from parent game options
  const parentGameOptions = demoGames.filter(g => !g.is_expansion);

  // Import (Demo): Uses the same AI-powered extraction as the live version
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = importUrl.trim();
    if (!trimmed) return;

    setIsImporting(true);

    const selectedParent = importAsExpansion && importParentGameId
      ? demoGames.find((g) => g.id === importParentGameId)
      : null;

    const bggIdMatch = trimmed.match(/boardgame\/(\d+)/);
    const bggId = bggIdMatch?.[1] ?? null;

    // Default/fallback values
    let title = "Imported Game";
    let description: string | null = null;
    let imageUrl: string | null = null;
    let minPlayers: number | null = null;
    let maxPlayers: number | null = null;
    let suggestedAge: string | null = null;
    let playTime: GameWithRelations["play_time"] = "45-60 Minutes";
    let difficulty: GameWithRelations["difficulty"] = "3 - Medium";
    let gameType: GameWithRelations["game_type"] = "Board Game";
    let mechanics: { id: string; name: string }[] = [];
    let publisher: { id: string; name: string } | null = null;

    // Try BGG lookup with AI extraction (same as live version)
    if (bggId) {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bgg-lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bgg_id: bggId, use_ai: true }),
        });

        const data = await res.json().catch(() => null);
        if (res.ok && data?.success && data?.data) {
          title = data.data.title || title;
          description = data.data.description || null;
          imageUrl = data.data.image_url || null;
          minPlayers = typeof data.data.min_players === "number" ? data.data.min_players : null;
          maxPlayers = typeof data.data.max_players === "number" ? data.data.max_players : null;
          suggestedAge = data.data.suggested_age || null;
          
          // Use play_time directly if available, otherwise map from minutes
          if (data.data.play_time) {
            playTime = data.data.play_time as GameWithRelations["play_time"];
          } else {
            const minutes = typeof data.data.playing_time_minutes === "number" ? data.data.playing_time_minutes : null;
            if (minutes != null) {
              if (minutes <= 15) playTime = "0-15 Minutes";
              else if (minutes <= 30) playTime = "15-30 Minutes";
              else if (minutes <= 45) playTime = "30-45 Minutes";
              else if (minutes <= 60) playTime = "45-60 Minutes";
              else if (minutes <= 90) playTime = "60+ Minutes";
              else if (minutes <= 180) playTime = "2+ Hours";
              else playTime = "3+ Hours";
            }
          }
          
          // Use difficulty and game_type from AI extraction
          if (data.data.difficulty) {
            difficulty = data.data.difficulty as GameWithRelations["difficulty"];
          }
          if (data.data.game_type) {
            gameType = data.data.game_type as GameWithRelations["game_type"];
          }
          
          // Convert mechanics array to the expected format
          if (Array.isArray(data.data.mechanics)) {
            mechanics = data.data.mechanics.map((name: string) => ({
              id: crypto.randomUUID(),
              name,
            }));
          }
          
          // Convert publisher to expected format
          if (data.data.publisher) {
            publisher = {
              id: crypto.randomUUID(),
              name: data.data.publisher,
            };
          }
        }
      } catch (err) {
        console.error("BGG lookup error:", err);
        // Will fallback to defaults
      }
    }

    // If we still don't have a title, try extracting from the URL path
    if (title === "Imported Game") {
      try {
        const url = new URL(trimmed);
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (pathParts.length > 0) {
          title = pathParts[pathParts.length - 1]
            .replace(/-/g, " ")
            .replace(/_/g, " ")
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        }
      } catch {
        // Invalid URL, keep default
      }
    }

    // Last-resort placeholder image (stable per title)
    if (!imageUrl) {
      const seed = title.toLowerCase().replace(/\s+/g, "");
      imageUrl = `https://picsum.photos/seed/${seed}/400/400`;
    }

    addDemoGame({
      title,
      description: description || `Imported from ${trimmed}`,
      image_url: imageUrl,
      difficulty,
      game_type: gameType,
      play_time: playTime,
      min_players: minPlayers ?? 2,
      max_players: maxPlayers ?? 4,
      suggested_age: suggestedAge ?? "10+",
      is_coming_soon: importAsComingSoon,
      is_for_sale: importAsForSale,
      sale_price: importAsForSale && importSalePrice ? parseFloat(importSalePrice) : null,
      sale_condition: importAsForSale ? importSaleCondition : null,
      is_expansion: importAsExpansion,
      parent_game_id: importAsExpansion ? importParentGameId : null,
      location_room: importLocationRoom.trim() || null,
      location_shelf: importLocationShelf.trim() || null,
      location_misc: importLocationMisc.trim() || null,
      admin_data: (importPurchasePrice || importPurchaseDate) ? {
        id: `admin-${Date.now()}`,
        game_id: `demo-${Date.now()}`,
        purchase_price: importPurchasePrice ? parseFloat(importPurchasePrice) : null,
        purchase_date: importPurchaseDate || null,
      } : null,
      sleeved: importSleeved,
      upgraded_components: importUpgradedComponents,
      crowdfunded: importCrowdfunded,
      inserts: importInserts,
      bgg_url: trimmed,
      bgg_id: bggId,
      mechanics,
      publisher,
    });

    const statusLabel = importAsExpansion
      ? `as an expansion${selectedParent ? ` of "${selectedParent.title}"` : ""}`
      : importAsComingSoon
        ? 'to "Coming Soon" list'
        : importAsForSale
          ? 'to "For Sale" section'
          : "to collection";

    toast({
      title: "Game imported! (Demo)",
      description: `"${title}" has been added ${statusLabel}.`,
    });

    // Reset form
    setImportUrl("");
    setImportAsComingSoon(false);
    setImportAsForSale(false);
    setImportAsExpansion(false);
    setImportParentGameId(null);
    setImportSalePrice("");
    setImportSaleCondition(null);
    setImportLocationRoom("");
    setImportLocationShelf("");
    setImportLocationMisc("");
    setImportPurchasePrice("");
    setImportPurchaseDate("");
    setImportSleeved(false);
    setImportUpgradedComponents(false);
    setImportCrowdfunded(false);
    setImportInserts(false);
    setIsImporting(false);
  };

  if (!isDemoMode) {
    return (
      <Layout>
        <div className="container py-8">
          <p className="text-muted-foreground">Demo mode is not active.</p>
          <Button variant="link" onClick={() => navigate("/")}>
            Return to home
          </Button>
        </div>
      </Layout>
    );
  }

  const handleDeleteGame = (id: string, title: string) => {
    deleteDemoGame(id);
    toast({
      title: "Game removed (Demo)",
      description: `"${title}" has been removed from demo data.`,
    });
  };

  const handleReset = () => {
    resetDemoData();
    toast({
      title: "Demo data reset",
      description: "All demo data has been restored to defaults.",
    });
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Demo Mode Banner */}
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400">Demo Mode Active</AlertTitle>
          <AlertDescription className="text-amber-600/80 dark:text-amber-400/80">
            You're exploring the admin panel in demo mode. All changes are temporary and won't affect any real data.
            Changes will be lost when you leave this page.
          </AlertDescription>
        </Alert>

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <div>
              <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                Admin Panel <Badge variant="outline" className="ml-2">Demo</Badge>
              </h1>
              <p className="text-muted-foreground mt-1">
                Explore the admin features with sample data
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Demo Data
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="collection" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="collection" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Game Collection
            </TabsTrigger>
            <TabsTrigger value="mechanics" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Mechanics
            </TabsTrigger>
            <TabsTrigger value="publishers" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Publishers
            </TabsTrigger>
          </TabsList>

          {/* Game Collection Tab */}
          <TabsContent value="collection" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Import Card */}
              <Card className="lg:col-span-1 card-elevated">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Import from Web
                  </CardTitle>
                  <CardDescription>
                    Simulate importing a game from any URL (demo mode creates placeholder data)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleImport} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="import-url">Game Page URL</Label>
                      <Input
                        id="import-url"
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://boardgamegeek.com/boardgame/..."
                        disabled={isImporting}
                      />
                    </div>
                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-border bg-muted/50">
                      <Checkbox
                        id="import-coming-soon"
                        checked={importAsComingSoon}
                        onCheckedChange={(checked) => setImportAsComingSoon(checked === true)}
                        disabled={isImporting}
                      />
                      <div className="space-y-0.5">
                        <label htmlFor="import-coming-soon" className="text-sm font-medium cursor-pointer">
                          Coming Soon
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Mark as purchased/backed but not yet received
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                        <Checkbox
                          id="import-for-sale"
                          checked={importAsForSale}
                          onCheckedChange={(checked) => setImportAsForSale(checked === true)}
                          disabled={isImporting}
                        />
                        <div className="space-y-0.5">
                          <label htmlFor="import-for-sale" className="text-sm font-medium cursor-pointer text-green-700 dark:text-green-400">
                            For Sale
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Mark as available for purchase
                          </p>
                        </div>
                      </div>
                      {importAsForSale && (
                        <div className="grid gap-3 sm:grid-cols-2 p-3 rounded-lg border border-green-500/20 bg-green-500/5">
                          <div className="space-y-1">
                            <Label htmlFor="sale-price" className="text-xs">Price ($)</Label>
                            <Input
                              id="sale-price"
                              type="number"
                              min="0"
                              step="0.01"
                              value={importSalePrice}
                              onChange={(e) => setImportSalePrice(e.target.value)}
                              placeholder="0.00"
                              className="h-8"
                              disabled={isImporting}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Condition</Label>
                            <Select
                              value={importSaleCondition || ""}
                              onValueChange={(v) => setImportSaleCondition(v as SaleCondition)}
                              disabled={isImporting}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select..." />
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
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 rounded-lg border border-purple-500/30 bg-purple-500/10">
                        <Checkbox
                          id="import-expansion"
                          checked={importAsExpansion}
                          onCheckedChange={(checked) => {
                            setImportAsExpansion(checked === true);
                            if (!checked) setImportParentGameId(null);
                          }}
                          disabled={isImporting}
                        />
                        <div className="space-y-0.5">
                          <label htmlFor="import-expansion" className="text-sm font-medium cursor-pointer text-purple-700 dark:text-purple-400">
                            Expansion
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Mark as an expansion for a base game
                          </p>
                        </div>
                      </div>
                      {importAsExpansion && (
                        <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                          <Label className="text-xs">Parent Game</Label>
                          <Select
                            value={importParentGameId || ""}
                            onValueChange={setImportParentGameId}
                            disabled={isImporting}
                          >
                            <SelectTrigger className="mt-1 h-8">
                              <SelectValue placeholder="Select base game..." />
                            </SelectTrigger>
                            <SelectContent>
                              {parentGameOptions.map((g) => (
                                <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                      {/* Storage Location - Only show when NOT importing as Coming Soon */}
                      {!importAsComingSoon && (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3 p-3 rounded-lg border border-muted-foreground/30 bg-muted/30">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div className="space-y-0.5 flex-1">
                              <label className="text-sm font-medium">
                                Storage Location (Optional)
                              </label>
                              <p className="text-xs text-muted-foreground">
                                Pre-fill where this game will be stored
                              </p>
                            </div>
                          </div>
                          <div className="pl-6 grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor="import-location-room" className="text-xs">Room</Label>
                              <Select value={importLocationRoom} onValueChange={setImportLocationRoom} disabled={isImporting}>
                                <SelectTrigger className="h-8 text-sm">
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
                            <div className="space-y-1">
                              <Label htmlFor="import-location-shelf" className="text-xs">Shelf</Label>
                              <Input
                                id="import-location-shelf"
                                value={importLocationShelf}
                                onChange={(e) => setImportLocationShelf(e.target.value)}
                                placeholder="e.g., Top Shelf"
                                disabled={isImporting}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <Label htmlFor="import-location-misc" className="text-xs">Additional Notes</Label>
                              <Input
                                id="import-location-misc"
                                value={importLocationMisc}
                                onChange={(e) => setImportLocationMisc(e.target.value)}
                                placeholder="e.g., Behind the couch"
                                disabled={isImporting}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div className="pl-6 grid gap-3 sm:grid-cols-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="demo-import-sleeved"
                                checked={importSleeved}
                                onCheckedChange={(checked) => setImportSleeved(checked === true)}
                                disabled={isImporting}
                              />
                              <label htmlFor="demo-import-sleeved" className="text-sm cursor-pointer">
                                Sleeved
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="demo-import-upgraded"
                                checked={importUpgradedComponents}
                                onCheckedChange={(checked) => setImportUpgradedComponents(checked === true)}
                                disabled={isImporting}
                              />
                              <label htmlFor="demo-import-upgraded" className="text-sm cursor-pointer">
                                Upgraded Components
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="demo-import-crowdfunded"
                                checked={importCrowdfunded}
                                onCheckedChange={(checked) => setImportCrowdfunded(checked === true)}
                                disabled={isImporting}
                              />
                              <label htmlFor="demo-import-crowdfunded" className="text-sm cursor-pointer">
                                Crowdfunded
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="demo-import-inserts"
                                checked={importInserts}
                                onCheckedChange={(checked) => setImportInserts(checked === true)}
                                disabled={isImporting}
                              />
                              <label htmlFor="demo-import-inserts" className="text-sm cursor-pointer">
                                Inserts
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Purchase Information (Admin Only) */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                          <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <div className="space-y-0.5 flex-1">
                            <label className="text-sm font-medium text-amber-700 dark:text-amber-300">
                              Purchase Info (Admin Only)
                            </label>
                            <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                              Track your purchase - not publicly visible
                            </p>
                          </div>
                        </div>
                        <div className="pl-6 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="demo-import-purchase-price" className="text-xs">Purchase Price ($)</Label>
                            <Input
                              id="demo-import-purchase-price"
                              type="number"
                              min="0"
                              step="0.01"
                              value={importPurchasePrice}
                              onChange={(e) => setImportPurchasePrice(e.target.value)}
                              placeholder="0.00"
                              disabled={isImporting}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="demo-import-purchase-date" className="text-xs">Purchase Date</Label>
                            <Input
                              id="demo-import-purchase-date"
                              type="date"
                              value={importPurchaseDate}
                              onChange={(e) => setImportPurchaseDate(e.target.value)}
                              disabled={isImporting}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    <Button type="submit" className="w-full" disabled={isImporting || !importUrl.trim()}>
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Import Game
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Add Game Card */}
              <Card className="lg:col-span-2 card-elevated">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Add New Game
                  </CardTitle>
                  <CardDescription>
                    Manually add a new game or bulk import multiple games
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-3 flex-wrap">
                  <Button onClick={() => navigate("/demo/add")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Game Manually
                  </Button>
                  <Button variant="outline" onClick={() => setShowBulkImport(true)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Bulk Import
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Games Table */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="font-display">
                  Game Collection ({demoGames.length})
                </CardTitle>
                <CardDescription>
                  Manage your demo game library
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {demoGames.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No games in your demo collection yet. Import or add one above!
                  </p>
                ) : (
                  <GameCollectionTable
                    games={demoGames}
                    filterLetter={gameFilterLetter}
                    setFilterLetter={setGameFilterLetter}
                    currentPage={gameCurrentPage}
                    setCurrentPage={setGameCurrentPage}
                    gamesPerPage={GAMES_PER_PAGE}
                    onEdit={(id) => navigate(`/demo/edit/${id}`)}
                    onDelete={handleDeleteGame}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mechanics Tab */}
          <TabsContent value="mechanics" className="space-y-6">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>Game Mechanics</CardTitle>
                <CardDescription>
                  {mechanics.length} mechanics in demo data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mechanics.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No mechanics found in demo data.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {mechanics.map((m) => (
                      <Badge key={m.id} variant="secondary" className="text-sm py-1 px-3">
                        {m.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Publishers Tab */}
          <TabsContent value="publishers" className="space-y-6">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>Publishers</CardTitle>
                <CardDescription>
                  {publishers.length} publishers in demo data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {publishers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No publishers found in demo data.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {publishers.map((p) => (
                      <Badge key={p.id} variant="secondary" className="text-sm py-1 px-3">
                        {p.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview Link */}
        <div className="text-center pt-4">
          <Button variant="outline" asChild>
            <Link to="/?demo=true">
              <Eye className="h-4 w-4 mr-2" />
              View Demo Collection
            </Link>
          </Button>
        </div>

        {/* Bulk Import Dialog */}
        <BulkImportDialog
          open={showBulkImport}
          onOpenChange={setShowBulkImport}
          isDemo={true}
        />
      </div>
    </Layout>
  );
};

export default DemoSettings;
