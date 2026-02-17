import { UserPlus, UserMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsFollowing, useToggleFollow } from "@/hooks/useFollow";

interface FollowButtonProps {
  currentUserId: string | undefined;
  targetUserId: string;
}

export function FollowButton({ currentUserId, targetUserId }: FollowButtonProps) {
  const { data: isFollowing, isLoading } = useIsFollowing(currentUserId, targetUserId);
  const toggleFollow = useToggleFollow(currentUserId, targetUserId);

  if (!currentUserId || currentUserId === targetUserId) return null;

  return (
    <Button
      size="sm"
      variant={isFollowing ? "outline" : "default"}
      disabled={isLoading || toggleFollow.isPending}
      onClick={() => toggleFollow.mutate(!!isFollowing)}
      className="gap-1.5"
    >
      {toggleFollow.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isFollowing ? (
        <UserMinus className="h-3.5 w-3.5" />
      ) : (
        <UserPlus className="h-3.5 w-3.5" />
      )}
      {isFollowing ? "Unfollow" : "Follow"}
    </Button>
  );
}
