import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { 
  MessageSquare, 
  ArrowRight,
  Pin,
  MessageCircle,
  Library as LibraryIcon,
  Megaphone,
  Users,
  ShoppingBag
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRecentLibraryThreads, useLibraryCategories, useLibrariesForumEnabled, type ForumThread } from "@/hooks/useForum";
import { useMyMemberships } from "@/hooks/useLibraryMembership";
import { getLibraryUrl } from "@/hooks/useTenantUrl";

// Map icon names to Lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  Megaphone,
  MessageSquare,
  Users,
  ShoppingBag,
};

const COLOR_MAP: Record<string, string> = {
  amber: "text-amber-500",
  blue: "text-blue-500",
  green: "text-green-500",
  purple: "text-purple-500",
};

function ThreadPreview({ thread, librarySlug }: { thread: ForumThread; librarySlug?: string }) {
  const Icon = thread.category?.icon ? ICON_MAP[thread.category.icon] || MessageSquare : MessageSquare;
  const colorClass = thread.category?.color ? COLOR_MAP[thread.category.color] || "text-blue-500" : "text-blue-500";

  // For library threads, link to the library's subdomain
  const threadUrl = librarySlug 
    ? getLibraryUrl(librarySlug, `/community/thread/${thread.id}`)
    : `/community/thread/${thread.id}`;

  return (
    <a
      href={threadUrl}
      className="flex items-start gap-3 p-3 rounded-lg bg-wood-medium/20 hover:bg-wood-medium/40 transition-colors group"
    >
      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${colorClass}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {thread.is_pinned && <Pin className="h-3 w-3 text-secondary" />}
          <span className="text-sm font-medium text-cream truncate group-hover:text-secondary transition-colors">
            {thread.title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-cream/60">
          <span>{thread.author?.display_name || "Unknown"}</span>
          <span>•</span>
          <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
          {thread.reply_count > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {thread.reply_count}
              </span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}

interface LibraryTabContentProps {
  libraryId: string;
  librarySlug: string;
  libraryName: string;
}

function LibraryTabContent({ libraryId, librarySlug, libraryName }: LibraryTabContentProps) {
  const { data: categories = [], isLoading: categoriesLoading } = useLibraryCategories(libraryId);
  const { data: recentThreads = [], isLoading: threadsLoading } = useRecentLibraryThreads([libraryId], 5);

  const isLoading = categoriesLoading || threadsLoading;
  const libraryForumUrl = getLibraryUrl(librarySlug, "/community");

  return (
    <div className="space-y-4">
      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const Icon = ICON_MAP[cat.icon] || MessageSquare;
            const colorClass = COLOR_MAP[cat.color] || "text-blue-500";
            return (
              <a key={cat.id} href={getLibraryUrl(librarySlug, `/community/${cat.slug}`)}>
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80 transition-colors"
                >
                  <Icon className={`h-3 w-3 mr-1 ${colorClass}`} />
                  {cat.name}
                </Badge>
              </a>
            );
          })}
        </div>
      )}

      {/* Recent Threads */}
      <div className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full bg-wood-medium/40" />
            <Skeleton className="h-16 w-full bg-wood-medium/40" />
          </>
        ) : recentThreads.length > 0 ? (
          recentThreads.map((thread) => (
            <ThreadPreview key={thread.id} thread={thread} librarySlug={librarySlug} />
          ))
        ) : categories.length > 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="h-8 w-8 mx-auto text-cream/40 mb-2" />
            <p className="text-sm text-cream/60">No discussions yet in {libraryName}</p>
            <a href={libraryForumUrl} className="mt-2 inline-block">
              <Button variant="outline" size="sm" className="border-secondary/50 text-cream">
                Start a Discussion
              </Button>
            </a>
          </div>
        ) : (
          <div className="text-center py-6">
            <MessageSquare className="h-8 w-8 mx-auto text-cream/40 mb-2" />
            <p className="text-sm text-cream/60">Forums not enabled for this library</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function LibraryForumCard() {
  const { data: memberships = [], isLoading: membershipsLoading } = useMyMemberships();
  const [activeTab, setActiveTab] = useState<string>("");

  // Get all library IDs from memberships
  const allLibraryIds = memberships
    .filter(m => m.library)
    .map(m => m.library!.id);

  // Check which libraries have forums enabled
  const { data: forumEnabledMap, isLoading: forumCheckLoading } = useLibrariesForumEnabled(allLibraryIds);

  const isLoading = membershipsLoading || forumCheckLoading;

  // Filter memberships to libraries that have forums enabled
  const librariesWithForums = memberships.filter(m => 
    m.library && forumEnabledMap?.get(m.library.id) === true
  );

  // Set default tab when memberships load
  if (librariesWithForums.length > 0 && !activeTab) {
    setActiveTab(librariesWithForums[0].library!.id);
  }

  if (isLoading) {
    return (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <LibraryIcon className="h-5 w-5 text-secondary" />
            My Library Forums
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full bg-wood-medium/40" />
        </CardContent>
      </Card>
    );
  }

  if (librariesWithForums.length === 0) {
    return (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <LibraryIcon className="h-5 w-5 text-secondary" />
            My Library Forums
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <LibraryIcon className="h-8 w-8 mx-auto text-cream/40 mb-2" />
            <p className="text-sm text-cream/60">Join a community to access their forums</p>
            <Link to="/directory" className="mt-2 inline-block">
              <Button variant="outline" size="sm" className="border-secondary/50 text-cream">
                Browse Communities
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <LibraryIcon className="h-5 w-5 text-secondary" />
          My Library Forums
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 bg-wood-dark/60 border border-wood-medium/40 flex-wrap h-auto gap-1 p-1">
            {librariesWithForums.map((membership) => (
              <TabsTrigger
                key={membership.library!.id}
                value={membership.library!.id}
                className="text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
              >
                {membership.library!.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {librariesWithForums.map((membership) => (
            <TabsContent key={membership.library!.id} value={membership.library!.id}>
              <LibraryTabContent
                libraryId={membership.library!.id}
                librarySlug={membership.library!.slug}
                libraryName={membership.library!.name}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
