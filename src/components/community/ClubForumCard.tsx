import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Pin,
  MessageCircle,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClubCategories, useRecentClubThreads, useCategoryThreads, type ForumThread } from "@/hooks/useForum";
import { FeaturedBadge } from "@/components/achievements/FeaturedBadge";
import { InlineForumManagement } from "./InlineForumManagement";
import { FORUM_ICON_MAP, FORUM_COLOR_MAP } from "@/lib/forumOptions";

const ICON_MAP = FORUM_ICON_MAP;
const COLOR_MAP: Record<string, string> = FORUM_COLOR_MAP;

function ClubThreadPreview({ thread, clubSlug }: { thread: ForumThread; clubSlug: string }) {
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

interface ClubForumCardProps {
  clubId: string;
  clubSlug: string;
  isOwner: boolean;
  activeCategorySlug?: string;
}

export function ClubForumCard({ clubId, clubSlug, isOwner, activeCategorySlug }: ClubForumCardProps) {
  const { data: categories = [], isLoading: categoriesLoading } = useClubCategories(clubId);
  const { data: recentThreads = [], isLoading: threadsLoading } = useRecentClubThreads(clubId, 5);

  const activeCategory = activeCategorySlug
    ? categories.find((c) => c.slug === activeCategorySlug)
    : undefined;

  const { data: categoryThreads = [], isLoading: categoryThreadsLoading } = useCategoryThreads(
    activeCategory?.id,
    50
  );

  const isLoading = categoriesLoading || threadsLoading;

  // If viewing a specific category, show its threads
  if (activeCategorySlug && activeCategory) {
    const Icon = ICON_MAP[activeCategory.icon] || MessageSquare;
    const colorClass = COLOR_MAP[activeCategory.color] || "text-blue-500";

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/club/${clubSlug}`}
            className="inline-flex items-center gap-1 text-sm text-cream/60 hover:text-cream transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to forum
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${colorClass}`} />
          <h2 className="text-lg font-display font-bold text-cream">{activeCategory.name}</h2>
        </div>
        {activeCategory.description && (
          <p className="text-sm text-cream/60">{activeCategory.description}</p>
        )}

        <div className="space-y-2">
          {categoryThreadsLoading ? (
            <>
              <Skeleton className="h-16 w-full bg-wood-medium/40" />
              <Skeleton className="h-16 w-full bg-wood-medium/40" />
            </>
          ) : categoryThreads.length > 0 ? (
            categoryThreads.map((thread) => (
              <ClubThreadPreview key={thread.id} thread={thread} clubSlug={clubSlug} />
            ))
          ) : (
            <div className="text-center py-6">
              <MessageSquare className="h-8 w-8 mx-auto text-cream/40 mb-2" />
              <p className="text-sm text-cream/60">No threads in this category yet</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Management controls for club owner */}
      {isOwner && (
        <div className="flex justify-end">
          <InlineForumManagement
            scope="club"
            clubId={clubId}
            categories={categories}
            isLoading={categoriesLoading}
          />
        </div>
      )}

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const Icon = ICON_MAP[cat.icon] || MessageSquare;
            const colorClass = COLOR_MAP[cat.color] || "text-blue-500";
            return (
              <Link key={cat.id} to={`/club/${clubSlug}/forum/${cat.slug}`}>
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80 transition-colors"
                >
                  <Icon className={`h-3 w-3 mr-1 ${colorClass}`} />
                  {cat.name}
                </Badge>
              </Link>
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
            <ClubThreadPreview key={thread.id} thread={thread} clubSlug={clubSlug} />
          ))
        ) : categories.length > 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="h-8 w-8 mx-auto text-cream/40 mb-2" />
            <p className="text-sm text-cream/60">No discussions yet</p>
            <p className="text-xs text-cream/40 mt-1">
              Start a thread in one of the categories above
            </p>
          </div>
        ) : (
          <div className="text-center py-6">
            <MessageSquare className="h-8 w-8 mx-auto text-cream/40 mb-2" />
            <p className="text-sm text-cream/60">No forum categories yet</p>
            {isOwner ? (
              <p className="text-xs text-cream/40 mt-1">Use the Manage button above to create categories</p>
            ) : (
              <p className="text-xs text-cream/40 mt-1">The club owner hasn't set up forum categories yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
