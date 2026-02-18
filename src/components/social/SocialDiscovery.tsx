import { useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDebounce } from "@/hooks/useDebounce";
import { useUserSearch, useSuggestedUsers } from "@/hooks/useSocialDiscovery";
import { FollowButton } from "@/components/social/FollowButton";
import { UserLink } from "@/components/social/UserLink";
import { useAuth } from "@/hooks/useAuth";

export function SocialDiscovery() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data: searchResults = [], isLoading: searching } = useUserSearch(debouncedQuery);
  const { data: suggested = [] } = useSuggestedUsers();

  const showSearch = debouncedQuery.length >= 2;
  const displayList = showSearch ? searchResults : suggested;

  return (
    <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2 text-cream">
          <UserPlus className="h-4 w-4 text-secondary" />
          Discover Users
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream/40" />
          <Input
            placeholder="Search by username or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-8 text-sm bg-wood-dark/40 border-wood-medium/40 text-cream placeholder:text-cream/30"
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {searching && showSearch ? (
          <p className="text-xs text-cream/50 text-center py-4">Searching…</p>
        ) : displayList.length === 0 ? (
          <div className="text-center py-6">
            <Users className="h-8 w-8 mx-auto text-cream/20 mb-2" />
            <p className="text-xs text-cream/50">
              {showSearch ? "No users found" : "No suggestions yet — start following people!"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {!showSearch && (
              <p className="text-xs text-cream/40 mb-3">
                {suggested.length > 0 ? "People you might know" : ""}
              </p>
            )}
            {displayList.map((u: any) => {
              const initials = (u.display_name || u.username || "?")
                .split(" ")
                .map((s: string) => s[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <div key={u.user_id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <UserLink
                      username={u.username}
                      displayName={u.display_name}
                      className="text-sm font-medium text-cream"
                    />
                    <p className="text-xs text-cream/40">
                      {u.games_owned} games · {u.sessions_logged} plays
                    </p>
                  </div>
                  <FollowButton currentUserId={user?.id} targetUserId={u.user_id} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
