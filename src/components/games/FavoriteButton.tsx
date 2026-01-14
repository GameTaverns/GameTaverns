import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/useFavorites";

interface FavoriteButtonProps {
  gameId: string;
  className?: string;
  size?: "sm" | "default";
}

export function FavoriteButton({
  gameId,
  className,
  size = "default",
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(gameId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(gameId);
  };

  return (
    <Button
      variant="ghost"
      size={size === "sm" ? "icon" : "default"}
      onClick={handleClick}
      className={cn(
        "transition-all",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        favorited
          ? "text-yellow-500 hover:text-yellow-600"
          : "text-muted-foreground hover:text-yellow-500",
        className
      )}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Star
        className={cn(
          size === "sm" ? "h-4 w-4" : "h-5 w-5",
          favorited && "fill-current"
        )}
      />
    </Button>
  );
}
