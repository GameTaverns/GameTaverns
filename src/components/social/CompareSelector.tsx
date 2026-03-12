import { useState } from "react";
import { GitCompare, Search, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { LibraryComparison } from "./LibraryComparison";

interface FollowedUser {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export function CompareSelector() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<FollowedUser | null>(null);
  const [search, setSearch] = useState("");

  // Get users the current user follows
  const { data: following = [], isLoading } = useQuery({
    queryKey: ["following-for-compare", user?.id],
    queryFn: async (): Promise<FollowedUser[]> => {
      if (!user) return [];

      const { data: follows } = await (supabase as any)
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);

      if (!follows || follows.length === 0) return [];

      const ids = follows.map((f: any) => f.following_id);
      const { data: profiles } = await (supabase as any)
        .from("public_user_profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", ids);

      return (profiles || []).filter((p: any) => p.username);
    },
    enabled: !!user,
  });

  // Get current user profile info
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-for-compare", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("public_user_profiles")
        .select("username, display_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const filtered = search
    ? following.filter(
        (u) =>
          u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
          u.username?.toLowerCase().includes(search.toLowerCase())
      )
    : following;

  if (!user) {
    return (
      <Card className="bg-card/90 border-border">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Log in to compare your library with people you follow.
        </CardContent>
      </Card>
    );
  }

  if (selectedUser) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} className="gap-1.5 text-xs">
          ← Choose different user
        </Button>
        <LibraryComparison
          currentUserId={user.id}
          targetUserId={selectedUser.user_id}
          currentUserName={myProfile?.display_name || myProfile?.username || "You"}
          targetUserName={selectedUser.display_name || selectedUser.username || "User"}
          currentUserAvatar={myProfile?.avatar_url}
          targetUserAvatar={selectedUser.avatar_url}
        />
      </div>
    );
  }

  return (
    <Card className="bg-card/90 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-primary" />
          Compare Libraries
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Select someone you follow to compare your game collections, see what you have in common, and find great games to play together.
        </p>

        {following.length > 5 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search people you follow..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-6">
            <User className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {following.length === 0
                ? "Follow some users first to compare libraries!"
                : "No matches found."}
            </p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {filtered.map((u) => (
              <button
                key={u.user_id}
                onClick={() => setSelectedUser(u)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {(u.display_name || u.username || "?")[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.display_name || u.username}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>
                <GitCompare className="h-4 w-4 ml-auto text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
