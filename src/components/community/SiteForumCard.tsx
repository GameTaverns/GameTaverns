import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { 
  Megaphone, 
  MessageSquare, 
  Users, 
  ShoppingBag, 
  ArrowRight,
  Pin,
  MessageCircle 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentSiteThreads, useSiteWideCategories, type ForumThread } from "@/hooks/useForum";
import { FeaturedBadge } from "@/components/achievements/FeaturedBadge";
import { useAuth } from "@/hooks/useAuth";
import { InlineForumManagement } from "./InlineForumManagement";
import { FORUM_ICON_MAP, FORUM_COLOR_MAP } from "@/lib/forumOptions";

// Use shared maps
const ICON_MAP = FORUM_ICON_MAP;
const COLOR_MAP = FORUM_COLOR_MAP;

function ThreadPreview({ thread }: { thread: ForumThread }) {
  const Icon = thread.category?.icon ? ICON_MAP[thread.category.icon] || MessageSquare : MessageSquare;
  const colorClass = thread.category?.color ? COLOR_MAP[thread.category.color] || "text-blue-500" : "text-blue-500";

  return (
    <Link
      to={`/community/thread/${thread.id}`}
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
          <FeaturedBadge achievement={thread.author?.featured_badge ?? null} size="xs" />
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
    </Link>
  );
}

export function SiteForumCard() {
  const { data: categories = [], isLoading: categoriesLoading } = useSiteWideCategories();
  const { data: recentThreads = [], isLoading: threadsLoading } = useRecentSiteThreads(5);
  const { isAdmin } = useAuth();

  const isLoading = categoriesLoading || threadsLoading;

  return (
    <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-secondary" />
            Site-Wide Forums
          </CardTitle>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <InlineForumManagement
                scope="site"
                categories={categories}
                isLoading={categoriesLoading}
              />
            )}
            <Link to="/community">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-cream/70 hover:text-cream hover:bg-wood-medium/40"
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          {isLoading ? (
            <>
              <Skeleton className="h-6 w-24 bg-wood-medium/40" />
              <Skeleton className="h-6 w-20 bg-wood-medium/40" />
              <Skeleton className="h-6 w-16 bg-wood-medium/40" />
            </>
          ) : (
            categories.map((cat) => {
              const Icon = ICON_MAP[cat.icon] || MessageSquare;
              const colorClass = COLOR_MAP[cat.color] || "text-blue-500";
              return (
                <Link key={cat.id} to={`/community/${cat.slug}`}>
                  <Badge 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-secondary/80 transition-colors"
                  >
                    <Icon className={`h-3 w-3 mr-1 ${colorClass}`} />
                    {cat.name}
                  </Badge>
                </Link>
              );
            })
          )}
        </div>

        {/* Recent Threads */}
        <div className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full bg-wood-medium/40" />
              <Skeleton className="h-16 w-full bg-wood-medium/40" />
              <Skeleton className="h-16 w-full bg-wood-medium/40" />
            </>
          ) : recentThreads.length > 0 ? (
            recentThreads.map((thread) => (
              <ThreadPreview key={thread.id} thread={thread} />
            ))
          ) : (
            <div className="text-center py-6">
              <MessageSquare className="h-8 w-8 mx-auto text-cream/40 mb-2" />
              <p className="text-sm text-cream/60">No discussions yet</p>
              <Link to="/community" className="mt-2 inline-block">
                <Button variant="outline" size="sm" className="border-secondary/50 text-cream">
                  Start a Discussion
                </Button>
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
