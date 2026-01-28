import { useState } from "react";
import { Loader2, Plus, Trash2, Tag, Building, Gamepad2, Gauge, Clock, Star, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useMechanics, usePublishers, useCreateMechanic, useCreatePublisher } from "@/hooks/useGames";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { Constants } from "@/integrations/supabase/types";

// Get enum values from the generated types
const GAME_TYPES = Constants.public.Enums.game_type;
const DIFFICULTY_LEVELS = Constants.public.Enums.difficulty_level;
const PLAY_TIMES = Constants.public.Enums.play_time;

export function CategoryManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { library } = useTenant();
  
  const { data: mechanics = [], isLoading: mechanicsLoading } = useMechanics();
  const { data: publishers = [], isLoading: publishersLoading } = usePublishers();
  const createMechanic = useCreateMechanic();
  const createPublisher = useCreatePublisher();
  
  const [newMechanicName, setNewMechanicName] = useState("");
  const [newPublisherName, setNewPublisherName] = useState("");
  const [isCreatingMechanic, setIsCreatingMechanic] = useState(false);
  const [isCreatingPublisher, setIsCreatingPublisher] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch wishlist summary for this library
  const { data: wishlistSummary = [] } = useQuery({
    queryKey: ["wishlist-summary", library?.id],
    queryFn: async () => {
      if (!library?.id) return [];
      
      // Get games with wishlist votes for this library
      const { data: games } = await supabase
        .from("games")
        .select("id, title, slug")
        .eq("library_id", library.id);
      
      if (!games || games.length === 0) return [];
      
      const gameIds = games.map(g => g.id);
      
      const { data: summary } = await supabase
        .from("game_wishlist_summary")
        .select("*")
        .in("game_id", gameIds)
        .gt("vote_count", 0)
        .order("vote_count", { ascending: false })
        .limit(10);
      
      // Map game info to summary
      return (summary || []).map(s => ({
        ...s,
        game: games.find(g => g.id === s.game_id)
      }));
    },
    enabled: !!library?.id
  });

  // Fetch favorite games for this library
  const { data: favoriteGames = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ["favorite-games", library?.id],
    queryFn: async () => {
      if (!library?.id) return [];
      
      const { data, error } = await supabase
        .from("games")
        .select("id, title, slug, is_favorite")
        .eq("library_id", library.id)
        .eq("is_favorite", true)
        .order("title");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!library?.id
  });

  const handleAddMechanic = async () => {
    if (!newMechanicName.trim()) return;
    
    setIsCreatingMechanic(true);
    try {
      await createMechanic.mutateAsync(newMechanicName.trim());
      setNewMechanicName("");
      toast({ title: "Mechanic added successfully" });
    } catch (error: any) {
      toast({
        title: "Failed to add mechanic",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingMechanic(false);
    }
  };

  const handleAddPublisher = async () => {
    if (!newPublisherName.trim()) return;
    
    setIsCreatingPublisher(true);
    try {
      await createPublisher.mutateAsync(newPublisherName.trim());
      setNewPublisherName("");
      toast({ title: "Publisher added successfully" });
    } catch (error: any) {
      toast({
        title: "Failed to add publisher",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingPublisher(false);
    }
  };

  const handleDeleteMechanic = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("mechanics")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["mechanics"] });
      toast({ title: "Mechanic deleted" });
    } catch (error: any) {
      toast({
        title: "Failed to delete mechanic",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeletePublisher = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("publishers")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["publishers"] });
      toast({ title: "Publisher deleted" });
    } catch (error: any) {
      toast({
        title: "Failed to delete publisher",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRemoveFavorite = async (gameId: string) => {
    try {
      const { error } = await supabase
        .from("games")
        .update({ is_favorite: false })
        .eq("id", gameId);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["favorite-games"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      toast({ title: "Removed from favorites" });
    } catch (error: any) {
      toast({
        title: "Failed to remove favorite",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Hardcoded Categories Section */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Game Types */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gamepad2 className="h-4 w-4" />
              Game Types
            </CardTitle>
            <CardDescription className="text-xs">
              Built-in game type categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {GAME_TYPES.map((type) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {type}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Difficulty Levels */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4" />
              Difficulty Levels
            </CardTitle>
            <CardDescription className="text-xs">
              Built-in complexity scale
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTY_LEVELS.map((level) => (
                <Badge key={level} variant="outline" className="text-xs">
                  {level}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Play Times */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Play Times
            </CardTitle>
            <CardDescription className="text-xs">
              Built-in duration ranges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {PLAY_TIMES.map((time) => (
                <Badge key={time} variant="outline" className="text-xs">
                  {time}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Editable Categories Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Mechanics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Game Mechanics
            </CardTitle>
            <CardDescription>
              Manage game mechanics like Deck Building, Worker Placement, etc.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newMechanicName}
                onChange={(e) => setNewMechanicName(e.target.value)}
                placeholder="New mechanic name"
                onKeyDown={(e) => e.key === "Enter" && handleAddMechanic()}
              />
              <Button 
                onClick={handleAddMechanic} 
                disabled={isCreatingMechanic || !newMechanicName.trim()}
              >
                {isCreatingMechanic ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {mechanicsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : mechanics.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No mechanics yet. Add your first one above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                {mechanics.map((mechanic) => (
                  <Badge
                    key={mechanic.id}
                    variant="secondary"
                    className="group flex items-center gap-1 pr-1"
                  >
                    {mechanic.name}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button 
                          className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={deletingId === mechanic.id}
                        >
                          {deletingId === mechanic.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3 text-destructive" />
                          )}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Mechanic</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{mechanic.name}"? This will remove it from all games.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteMechanic(mechanic.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Publishers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Publishers
            </CardTitle>
            <CardDescription>
              Manage game publishers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newPublisherName}
                onChange={(e) => setNewPublisherName(e.target.value)}
                placeholder="New publisher name"
                onKeyDown={(e) => e.key === "Enter" && handleAddPublisher()}
              />
              <Button 
                onClick={handleAddPublisher} 
                disabled={isCreatingPublisher || !newPublisherName.trim()}
              >
                {isCreatingPublisher ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {publishersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : publishers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No publishers yet. Add your first one above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                {publishers.map((publisher) => (
                  <Badge
                    key={publisher.id}
                    variant="outline"
                    className="group flex items-center gap-1 pr-1"
                  >
                    {publisher.name}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button 
                          className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={deletingId === publisher.id}
                        >
                          {deletingId === publisher.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3 text-destructive" />
                          )}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Publisher</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{publisher.name}"? This will remove it from all games.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeletePublisher(publisher.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Favorites & Wishlist Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Favorites */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-destructive" />
              Favorites
            </CardTitle>
            <CardDescription>
              Games you've marked as favorites. Mark games as favorites from the game edit page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {favoritesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : favoriteGames.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No favorites yet. Mark games as favorites when editing them.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                {favoriteGames.map((game) => (
                  <Badge
                    key={game.id}
                    variant="destructive"
                    className="group flex items-center gap-1 pr-1 bg-destructive/10 text-destructive border-destructive/30"
                  >
                    <Heart className="h-3 w-3 fill-current" />
                    {game.title}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove from Favorites</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove "{game.title}" from your favorites?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemoveFavorite(game.id)}>
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wishlist / Wanting to Play */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Wanting to Play
            </CardTitle>
            <CardDescription>
              Games that guests have voted for. Top 10 most requested games.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {wishlistSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No votes yet. Enable the wishlist feature to let guests vote on games.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {wishlistSummary.map((item, index) => (
                  <div
                    key={item.game_id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-5">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {item.game?.title || "Unknown Game"}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {item.vote_count} vote{item.vote_count !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
