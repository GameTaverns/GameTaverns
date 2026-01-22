import { useState, useEffect, useMemo } from "react";
import { Heart, Trash2, Users, Loader2, RefreshCw, TrendingUp } from "lucide-react";
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

interface WishlistEntry {
  id: string;
  game_id: string;
  guest_name: string | null;
  guest_identifier: string;
  created_at: string;
  game_title?: string;
  game_slug?: string;
}

interface WishlistSummary {
  game_id: string;
  vote_count: number;
  named_votes: number;
  game_title?: string;
  game_slug?: string;
}

export function WishlistAdmin() {
  const [entries, setEntries] = useState<WishlistEntry[]>([]);
  const [summary, setSummary] = useState<WishlistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  const fetchWishlistData = async () => {
    setIsLoading(true);
    try {
      // Fetch all wishlist entries
      const { data: wishlistData, error: wishlistError } = await supabase
        .from("game_wishlist")
        .select("*")
        .order("created_at", { ascending: false });

      if (wishlistError) throw wishlistError;

      // Fetch summary view
      const { data: summaryData, error: summaryError } = await supabase
        .from("game_wishlist_summary")
        .select("*");

      if (summaryError) throw summaryError;

      // Fetch game titles
      const gameIds = [...new Set([
        ...(wishlistData || []).map(e => e.game_id),
        ...(summaryData || []).map(s => s.game_id).filter(Boolean)
      ])];

      if (gameIds.length > 0) {
        const { data: gamesData } = await supabase
          .from("games")
          .select("id, title, slug")
          .in("id", gameIds);

        const gameMap = new Map(gamesData?.map(g => [g.id, { title: g.title, slug: g.slug }]) || []);

        setEntries((wishlistData || []).map(e => ({
          ...e,
          game_title: gameMap.get(e.game_id)?.title || "Unknown Game",
          game_slug: gameMap.get(e.game_id)?.slug
        })));

        setSummary((summaryData || [])
          .filter(s => s.game_id)
          .map(s => ({
            game_id: s.game_id!,
            vote_count: Number(s.vote_count) || 0,
            named_votes: Number(s.named_votes) || 0,
            game_title: gameMap.get(s.game_id!)?.title || "Unknown Game",
            game_slug: gameMap.get(s.game_id!)?.slug
          }))
          .sort((a, b) => b.vote_count - a.vote_count)
        );
      } else {
        setEntries([]);
        setSummary([]);
      }
    } catch (error) {
      console.error("Error fetching wishlist data:", error);
      toast({
        title: "Error",
        description: "Could not fetch wishlist data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlistData();
  }, []);

  const handleClearAllVotes = async () => {
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from("game_wishlist")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all rows

      if (error) throw error;

      toast({
        title: "Wishlist cleared",
        description: "All votes have been removed.",
      });
      
      fetchWishlistData();
    } catch (error) {
      console.error("Error clearing wishlist:", error);
      toast({
        title: "Error",
        description: "Could not clear wishlist",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from("game_wishlist")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Vote removed",
        description: "The vote has been removed.",
      });
      
      fetchWishlistData();
    } catch (error) {
      console.error("Error deleting vote:", error);
      toast({
        title: "Error",
        description: "Could not remove vote",
        variant: "destructive",
      });
    }
  };

  const totalVotes = useMemo(() => 
    summary.reduce((acc, s) => acc + s.vote_count, 0), 
    [summary]
  );

  const uniqueGames = summary.length;

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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Votes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold">{totalVotes}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Games with Votes</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Voters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-secondary-foreground" />
              <span className="text-2xl font-bold">
                {new Set(entries.map(e => e.guest_identifier)).size}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Most Wanted Games */}
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Most Wanted Games
            </CardTitle>
            <CardDescription>
              Games ranked by number of votes
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchWishlistData}>
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
                        Clear All Votes
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Wishlist Votes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all {totalVotes} votes from the wishlist. This is useful after a game night to reset for the next event. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAllVotes}>
                      Clear All Votes
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
              No votes yet. Share your game collection with guests and they can mark games they'd like to play!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead className="text-right">Total Votes</TableHead>
                  <TableHead className="text-right">Named Votes</TableHead>
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
                    <TableCell className="text-right">
                      <Badge variant="secondary">{item.vote_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{item.named_votes}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detailed Voter List */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Users className="h-5 w-5" />
            Individual Votes
          </CardTitle>
          <CardDescription>
            See who voted for which games (names are optional for guests)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No votes recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead>Voted At</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {entry.guest_name ? (
                        <span className="font-medium">{entry.guest_name}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Anonymous</span>
                      )}
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
                            <AlertDialogTitle>Remove Vote?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove this vote from {entry.guest_name || "Anonymous"} for "{entry.game_title}"?
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
