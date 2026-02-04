import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useLibraryDirectory } from "@/hooks/useLibraryDirectory";
import { useAuth } from "@/hooks/useAuth";
import { useTenantUrl, getLibraryUrl } from "@/hooks/useTenantUrl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Users, 
  Gamepad2, 
  Heart, 
  HeartOff, 
  TrendingUp, 
  Clock, 
  BookOpen,
  ExternalLink,
  ArrowLeft
} from "lucide-react";

export default function Directory() {
  const { user } = useAuth();
  const { buildUrl } = useTenantUrl();
  const [searchQuery, setSearchQuery] = useState("");
  const {
    libraries,
    isLoading,
    isFollowing,
    toggleFollow,
    searchLibraries,
    popularLibraries,
    newestLibraries,
    lendingLibraries,
  } = useLibraryDirectory();

  const filteredLibraries = searchQuery ? searchLibraries(searchQuery) : libraries;

  const LibraryCard = ({ library }: { library: typeof libraries[0] }) => {
    const following = isFollowing(library.id);
    
    return (
      <Card className="group hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={library.logo_url || undefined} alt={library.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-display">
                  {library.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  {library.name}
                </CardTitle>
                <CardDescription className="text-sm">
                  @{library.slug}
                </CardDescription>
              </div>
            </div>
            {user && (
              <Button
                variant={following ? "outline" : "default"}
                size="sm"
                onClick={() => toggleFollow(library.id)}
                className="gap-1"
              >
                {following ? (
                  <>
                    <HeartOff className="h-4 w-4" />
                    Unfollow
                  </>
                ) : (
                  <>
                    <Heart className="h-4 w-4" />
                    Follow
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {library.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {library.description}
            </p>
          )}
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Gamepad2 className="h-4 w-4" />
              {library.game_count} games
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {library.follower_count} followers
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {library.allow_lending && (
              <Badge variant="secondary" className="text-xs">
                <BookOpen className="h-3 w-3 mr-1" />
                Lending Available
              </Badge>
            )}
          </div>
          
          <a 
            href={getLibraryUrl(library.slug, "/")}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Visit Library
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    );
  };

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <Layout hideSidebar>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back to Dashboard */}
        {user && (
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        )}
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Library Directory
          </h1>
          <p className="text-muted-foreground">
            Discover game libraries from the community, follow your favorites, and borrow games
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search libraries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">
              All Libraries
            </TabsTrigger>
            <TabsTrigger value="popular" className="gap-1">
              <TrendingUp className="h-4 w-4" />
              Popular
            </TabsTrigger>
            <TabsTrigger value="newest" className="gap-1">
              <Clock className="h-4 w-4" />
              Newest
            </TabsTrigger>
            <TabsTrigger value="lending" className="gap-1">
              <BookOpen className="h-4 w-4" />
              With Lending
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {isLoading ? (
              <LoadingSkeleton />
            ) : filteredLibraries.length === 0 ? (
              <div className="text-center py-12">
                <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No libraries found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? "Try a different search term" : "No public libraries available yet"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLibraries.map((library) => (
                  <LibraryCard key={library.id} library={library} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="popular">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {popularLibraries.map((library) => (
                  <LibraryCard key={library.id} library={library} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="newest">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {newestLibraries.map((library) => (
                  <LibraryCard key={library.id} library={library} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="lending">
            {isLoading ? (
              <LoadingSkeleton />
            ) : lendingLibraries.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No lending libraries</h3>
                <p className="text-muted-foreground">
                  No libraries have enabled game lending yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lendingLibraries.map((library) => (
                  <LibraryCard key={library.id} library={library} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
