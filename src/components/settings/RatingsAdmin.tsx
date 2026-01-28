import { useState, useEffect, useMemo } from "react";
import { Star, Trash2, Users, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { supabase } from "@/integrations/backend/client";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

interface RatingEntry {
  id: string;
  game_id: string;
  guest_identifier: string;
  rating: number;
  created_at: string;
  updated_at: string;
  game_title?: string;
  game_slug?: string;
}

interface RatingSummary {
  game_id: string;
  rating_count: number;
  average_rating: number;
  game_title?: string;
  game_slug?: string;
}

export function RatingsAdmin() {
  const [entries, setEntries] = useState<RatingEntry[]>([]);
  const [summary, setSummary] = useState<RatingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchRatingsData = async () => {
    setIsLoading(true);
    try {
      // Fetch rating entries from privacy-safe view (excludes IP/fingerprint)
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("game_ratings_library_view")
        .select("*")
        .order("created_at", { ascending: false });

      if (ratingsError) throw ratingsError;

      // Fetch summary view
      const { data: summaryData, error: summaryError } = await supabase
        .from("game_ratings_summary")
        .select("*");

      if (summaryError) throw summaryError;

      // Fetch game titles
      const gameIds = [...new Set([
        ...(ratingsData || []).map(e => e.game_id),
        ...(summaryData || []).map(s => s.game_id).filter(Boolean)
      ])];

      if (gameIds.length > 0) {
        const { data: gamesData } = await supabase
          .from("games")
          .select("id, title, slug")
          .in("id", gameIds);

        const gameMap = new Map(gamesData?.map(g => [g.id, { title: g.title, slug: g.slug }]) || []);

        setEntries((ratingsData || []).map(e => ({
          ...e,
          game_title: gameMap.get(e.game_id)?.title || "Unknown Game",
          game_slug: gameMap.get(e.game_id)?.slug
        })));

        setSummary((summaryData || [])
          .filter(s => s.game_id)
          .map(s => ({
            game_id: s.game_id!,
            rating_count: Number(s.rating_count) || 0,
            average_rating: Number(s.average_rating) || 0,
            game_title: gameMap.get(s.game_id!)?.title || "Unknown Game",
            game_slug: gameMap.get(s.game_id!)?.slug
          }))
          .sort((a, b) => b.average_rating - a.average_rating)
        );
      } else {
        setEntries([]);
        setSummary([]);
      }
    } catch (error) {
      console.error("Error fetching ratings data:", error);
      toast({
        title: "Error",
        description: "Could not fetch ratings data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRatingsData();
  }, []);

  const handleClearAllRatings = async () => {
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from("game_ratings")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all rows

      if (error) throw error;

      toast({
        title: "Ratings cleared",
        description: "All ratings have been removed.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["game-ratings-summary"] });
      queryClient.invalidateQueries({ queryKey: ["user-ratings"] });
      fetchRatingsData();
    } catch (error) {
      console.error("Error clearing ratings:", error);
      toast({
        title: "Error",
        description: "Could not clear ratings",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from("game_ratings")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Rating removed",
        description: "The rating has been removed.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["game-ratings-summary"] });
      queryClient.invalidateQueries({ queryKey: ["user-ratings"] });
      fetchRatingsData();
    } catch (error) {
      console.error("Error deleting rating:", error);
      toast({
        title: "Error",
        description: "Could not remove rating",
        variant: "destructive",
      });
    }
  };

  const totalRatings = useMemo(() => 
    summary.reduce((acc, s) => acc + s.rating_count, 0), 
    [summary]
  );

  const uniqueGames = summary.length;

  const overallAverage = useMemo(() => {
    if (entries.length === 0) return 0;
    const total = entries.reduce((acc, e) => acc + e.rating, 0);
    return (total / entries.length).toFixed(1);
  }, [entries]);

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? "text-yellow-500 fill-yellow-500"
                : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Ratings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">{totalRatings}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Games Rated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{uniqueGames}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {renderStars(Number(overallAverage))}
              <span className="text-2xl font-bold">{overallAverage}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Rated Games */}
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Rated Games
            </CardTitle>
            <CardDescription>
              Games ranked by average rating
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchRatingsData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {entries.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isClearing}>
                    {isClearing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All Ratings
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Ratings?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all {totalRatings} ratings. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAllRatings}>
                      Clear All Ratings
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No ratings yet. Visitors can rate games from the game detail pages!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead>Average Rating</TableHead>
                  <TableHead className="text-right">Total Ratings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((item, index) => (
                  <TableRow key={item.game_id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      {item.game_slug ? (
                        <Link 
                          to={`/game/${item.game_slug}`}
                          className="hover:text-primary transition-colors"
                        >
                          {item.game_title}
                        </Link>
                      ) : (
                        item.game_title
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {renderStars(Math.round(item.average_rating))}
                        <span className="text-sm text-muted-foreground">
                          ({item.average_rating.toFixed(1)})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{item.rating_count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Individual Ratings */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Users className="h-5 w-5" />
            Individual Ratings
          </CardTitle>
          <CardDescription>
            All ratings from visitors (anonymous identifiers shown)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No ratings recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest ID</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Rated At</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {entry.guest_identifier.substring(0, 16)}...
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.game_slug ? (
                        <Link 
                          to={`/game/${entry.game_slug}`}
                          className="hover:text-primary transition-colors"
                        >
                          {entry.game_title}
                        </Link>
                      ) : (
                        entry.game_title
                      )}
                    </TableCell>
                    <TableCell>
                      {renderStars(entry.rating)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Rating?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove this {entry.rating}-star rating for "{entry.game_title}"?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteEntry(entry.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
