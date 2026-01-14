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
  Eye
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useDemoMode } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { GameWithRelations } from "@/types/game";

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
  const { isDemoMode, demoGames, deleteDemoGame, resetDemoData } = useDemoMode();

  const [gameFilterLetter, setGameFilterLetter] = useState<string | null>(null);
  const [gameCurrentPage, setGameCurrentPage] = useState(1);
  const GAMES_PER_PAGE = 20;

  // Demo mechanics and publishers derived from games
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
            <Card className="card-elevated">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Game Collection</CardTitle>
                  <CardDescription>
                    {demoGames.length} games in demo collection
                  </CardDescription>
                </div>
                <Button onClick={() => navigate("/demo/add")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Game
                </Button>
              </CardHeader>
              <CardContent>
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
      </div>
    </Layout>
  );
};

export default DemoSettings;
