import { useState } from "react";
import { Loader2, Plus, Trash2, Tag, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useQueryClient } from "@tanstack/react-query";

export function CategoryManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: mechanics = [], isLoading: mechanicsLoading } = useMechanics();
  const { data: publishers = [], isLoading: publishersLoading } = usePublishers();
  const createMechanic = useCreateMechanic();
  const createPublisher = useCreatePublisher();
  
  const [newMechanicName, setNewMechanicName] = useState("");
  const [newPublisherName, setNewPublisherName] = useState("");
  const [isCreatingMechanic, setIsCreatingMechanic] = useState(false);
  const [isCreatingPublisher, setIsCreatingPublisher] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  return (
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
  );
}
