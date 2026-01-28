import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  gameId: string;
  className?: string;
  size?: "sm" | "default";
}

export function FavoriteButton({ gameId, className, size = "default" }: FavoriteButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isOwner } = useTenant();
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch current favorite status
  const { data: isFavorite = false } = useQuery({
    queryKey: ["game-favorite", gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("is_favorite")
        .eq("id", gameId)
        .single();
      
      if (error) throw error;
      return data?.is_favorite || false;
    },
    enabled: !!gameId && isOwner,
  });

  // Only show for library owners
  if (!isOwner) return null;

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("games")
        .update({ is_favorite: !isFavorite })
        .eq("id", gameId);

      if (error) throw error;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["game-favorite", gameId] });
      queryClient.invalidateQueries({ queryKey: ["favorite-games"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });

      toast({
        title: isFavorite ? "Removed from favorites" : "Added to favorites",
      });
    } catch (error: any) {
      toast({
        title: "Failed to update favorite",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const iconSize = "h-5 w-5";

  return (
    <Button
      variant="ghost"
      size={size === "sm" ? "icon" : "sm"}
      className={cn(
        "transition-colors",
        isFavorite && "text-primary hover:text-primary",
        className
      )}
      onClick={handleToggle}
      disabled={isUpdating}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      {isUpdating ? (
        <Loader2 className={cn(iconSize, "animate-spin")} />
      ) : (
        <Star className={cn(iconSize, isFavorite && "fill-current")} />
      )}
    </Button>
  );
}
