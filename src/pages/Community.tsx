import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { 
  MessageSquare, 
  Megaphone, 
  Users, 
  ShoppingBag,
  ArrowLeft,
  Pin,
  Lock,
  MessageCircle,
  Plus,
  Eye
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useSiteWideCategories, 
  useCategoryThreads, 
  type ForumCategory,
  type ForumThread 
} from "@/hooks/useForum";
import { CreateThreadDialog } from "@/components/community/CreateThreadDialog";

// Map icon names to Lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  Megaphone,
  MessageSquare,
  Users,
  ShoppingBag,
};

const COLOR_MAP: Record<string, string> = {
  amber: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  blue: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  green: "bg-green-500/20 text-green-500 border-green-500/30",
  purple: "bg-purple-500/20 text-purple-500 border-purple-500/30",
};

function CategoryCard({ category }: { category: ForumCategory }) {
  const Icon = ICON_MAP[category.icon] || MessageSquare;
  const colorClass = COLOR_MAP[category.color] || COLOR_MAP.blue;

  return (
    <Link to={`/community/${category.slug}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${colorClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{category.name}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription>{category.description}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}

function ThreadRow({ thread }: { thread: ForumThread }) {
  return (
    <Link
      to={`/community/thread/${thread.id}`}
      className="flex items-center gap-4 p-4 rounded-lg hover:bg-accent/50 transition-colors border border-border"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {thread.is_pinned && (
            <Pin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          )}
          {thread.is_locked && (
            <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}
          <span className="font-medium truncate">{thread.title}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{thread.author?.display_name || "Unknown"}</span>
          <span>•</span>
          <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-shrink-0">
        <div className="flex items-center gap-1">
          <MessageCircle className="h-4 w-4" />
          <span>{thread.reply_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="h-4 w-4" />
          <span>{thread.view_count}</span>
        </div>
      </div>
    </Link>
  );
}

function CategoryView({ categorySlug }: { categorySlug: string }) {
  const { data: categories = [], isLoading: categoriesLoading } = useSiteWideCategories();
  const category = categories.find((c) => c.slug === categorySlug);
  const { data: threads = [], isLoading: threadsLoading } = useCategoryThreads(category?.id, 50);
  const [showCreateThread, setShowCreateThread] = useState(false);

  if (categoriesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Category not found</h2>
        <Link to="/community">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Forums
          </Button>
        </Link>
      </div>
    );
  }

  const Icon = ICON_MAP[category.icon] || MessageSquare;
  const colorClass = COLOR_MAP[category.color] || COLOR_MAP.blue;

  const pinnedThreads = threads.filter((t) => t.is_pinned);
  const regularThreads = threads.filter((t) => !t.is_pinned);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard?tab=community">
              <Button variant="ghost" className="-ml-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${colorClass}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{category.name}</h1>
              <p className="text-muted-foreground">{category.description}</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setShowCreateThread(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Thread
        </Button>
      </div>

      {/* Category Rules */}
      {category.rules && (
        <Card className="bg-muted/50">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">{category.rules}</p>
          </CardContent>
        </Card>
      )}

      {/* Threads */}
      {threadsLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : threads.length > 0 ? (
        <div className="space-y-2">
          {pinnedThreads.length > 0 && (
            <>
              <div className="text-sm font-medium text-muted-foreground px-1">Pinned</div>
              {pinnedThreads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} />
              ))}
              {regularThreads.length > 0 && (
                <div className="text-sm font-medium text-muted-foreground px-1 pt-4">Discussions</div>
              )}
            </>
          )}
          {regularThreads.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No discussions yet</h3>
          <p className="text-muted-foreground mb-4">Be the first to start a conversation!</p>
          <Button onClick={() => setShowCreateThread(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Start Discussion
          </Button>
        </div>
      )}

      <CreateThreadDialog
        open={showCreateThread}
        onOpenChange={setShowCreateThread}
        categoryId={category.id}
        categoryName={category.name}
      />
    </div>
  );
}

function ForumHome() {
  const { data: categories = [], isLoading } = useSiteWideCategories();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard?tab=community">
            <Button variant="ghost" className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Community Forums</h1>
            <p className="text-muted-foreground mt-1">
              Discuss board games, find players, and connect with the community
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Community() {
  const { categorySlug } = useParams();

  return (
    <Layout hideSidebar>
      <div className="max-w-4xl mx-auto">
        {categorySlug ? (
          <CategoryView categorySlug={categorySlug} />
        ) : (
          <ForumHome />
        )}
      </div>
    </Layout>
  );
}
