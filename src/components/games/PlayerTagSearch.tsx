import { useRef, useState } from "react";
import { Search, UserCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePlayerSearch, type UserSearchResult } from "@/hooks/usePlayerSearch";
import { cn } from "@/lib/utils";

interface PlayerTagSearchProps {
  onSelect: (user: UserSearchResult) => void;
  placeholder?: string;
  selectedUser?: UserSearchResult | null;
  onClear?: () => void;
}

export function PlayerTagSearch({
  onSelect,
  placeholder = "Search by name or username...",
  selectedUser,
  onClear,
}: PlayerTagSearchProps) {
  const { searchTerm, handleSearch, results, isLoading } = usePlayerSearch();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (selectedUser) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-primary/10 border-primary/30">
        <Avatar className="h-6 w-6">
          <AvatarImage src={selectedUser.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">
            {(selectedUser.display_name ?? selectedUser.username ?? "?")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium flex-1">
          {selectedUser.display_name ?? selectedUser.username}
        </span>
        <UserCheck className="h-4 w-4 text-primary" />
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="ml-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => {
            handleSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="pl-8 text-sm"
        />
      </div>

      {open && (searchTerm.length >= 2) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg overflow-hidden">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground text-center">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">No users found</div>
          ) : (
            <ul>
              {results.map((user) => (
                <li key={user.user_id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm",
                      "hover:bg-accent hover:text-accent-foreground transition-colors"
                    )}
                    onMouseDown={() => {
                      onSelect(user);
                      setOpen(false);
                    }}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {(user.display_name ?? user.username ?? "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <div className="font-medium">{user.display_name ?? user.username}</div>
                      {user.username && user.display_name && (
                        <div className="text-xs text-muted-foreground">@{user.username}</div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
