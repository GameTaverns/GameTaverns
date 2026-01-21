import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/hooks/useWishlist";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WishlistButtonProps {
  gameId: string;
  size?: "sm" | "default" | "lg" | "icon";
  showCount?: boolean;
  className?: string;
}

export function WishlistButton({
  gameId,
  size = "icon",
  showCount = true,
  className,
}: WishlistButtonProps) {
  const { hasVoted, getVoteCount, toggleVote, isPending } = useWishlist();
  
  const voted = hasVoted(gameId);
  const count = getVoteCount(gameId);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={size}
            className={cn(
              "transition-all",
              voted && "text-destructive hover:text-destructive/80",
              className
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleVote(gameId);
            }}
            disabled={isPending}
          >
            <Heart
              className={cn(
                "h-5 w-5 transition-all",
                voted && "fill-current"
              )}
            />
            {showCount && count > 0 && (
              <span className="ml-1 text-sm font-medium">{count}</span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{voted ? "Remove from wishlist" : "Add to game night wishlist"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
