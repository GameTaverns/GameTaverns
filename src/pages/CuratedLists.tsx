import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link, useNavigate } from "react-router-dom";
import {
  useCuratedLists,
  useMyLists,
  useCreateList,
  useDeleteList,
  type CuratedList,
} from "@/hooks/useCuratedLists";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ListOrdered, Heart, Plus, Trash2, ArrowRight, Lock, Globe } from "lucide-react";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { format } from "date-fns";

export default function CuratedListsPage() {
  const { tenantSlug, library } = useTenant();
  const { isAuthenticated } = useAuth();
  const { data: publicLists = [], isLoading } = useCuratedLists(library?.id);
  const { data: myLists = [] } = useMyLists();

  const listUrl = (id: string) => {
    const path = `/lists/${id}`;
    return tenantSlug ? getLibraryUrl(tenantSlug, path) : `/lists/${id}`;
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
              <ListOrdered className="h-7 w-7 text-primary" />
              Curated Lists
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Ranked game lists crafted by the community — vote for your favourites.
            </p>
          </div>
          {isAuthenticated && <CreateListButton libraryId={library?.id} />}
        </div>

        <Tabs defaultValue="community">
          <TabsList>
            <TabsTrigger value="community">Community</TabsTrigger>
            {isAuthenticated && <TabsTrigger value="mine">My Lists</TabsTrigger>}
          </TabsList>

          <TabsContent value="community" className="mt-4 space-y-3">
            {isLoading
              ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
              : publicLists.length === 0
              ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                  <ListOrdered className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No lists yet — be the first to create one!</p>
                </div>
              )
              : publicLists.map((list) => (
                <ListCard key={list.id} list={list} href={listUrl(list.id)} />
              ))}
          </TabsContent>

          {isAuthenticated && (
            <TabsContent value="mine" className="mt-4 space-y-3">
              {myLists.length === 0
                ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                    <p>You haven't created any lists yet.</p>
                  </div>
                )
                : myLists.map((list) => (
                  <MyListCard key={list.id} list={list} href={listUrl(list.id)} />
                ))}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}

function ListCard({ list, href }: { list: CuratedList; href: string }) {
  const itemCount = (list as any).items?.length ?? 0;
  const authorName = list.author?.display_name ?? list.author?.username ?? "Anonymous";

  return (
    <Link
      to={href}
      className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/40 transition-colors group"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <ListOrdered className="h-5 w-5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
          {list.title}
        </div>
        {list.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{list.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Avatar className="h-4 w-4">
            <AvatarFallback className="text-[8px]">{authorName[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <span>{authorName}</span>
          {itemCount > 0 && <span>· {itemCount} game{itemCount !== 1 ? "s" : ""}</span>}
          <span>· {format(new Date(list.created_at), "MMM d, yyyy")}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Heart className="h-3.5 w-3.5" />
          <span>{list.vote_count}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

function MyListCard({ list, href }: { list: CuratedList; href: string }) {
  const deleteList = useDeleteList();
  const { toast } = useToast();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await deleteList.mutateAsync(list.id);
      toast({ title: "List deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/40 transition-colors group">
      <Link to={href} className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          {list.is_public ? <Globe className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{list.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {(list as any).items?.length ?? 0} items · <Heart className="h-3 w-3 inline" /> {list.vote_count}
          </div>
        </div>
      </Link>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list?</AlertDialogTitle>
            <AlertDialogDescription>"{list.title}" will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateListButton({ libraryId }: { libraryId?: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const createList = useCreateList();
  const navigate = useNavigate();
  const { tenantSlug } = useTenant();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const list = await createList.mutateAsync({ title: title.trim(), description: desc.trim() || undefined, library_id: libraryId });
      toast({ title: "List created!" });
      setOpen(false);
      const path = `/lists/${list.id}`;
      navigate(tenantSlug ? getLibraryUrl(tenantSlug, path) : path);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New List
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new list</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="list-title">Title</Label>
            <Input id="list-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Best Gateway Games" maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="list-desc">Description (optional)</Label>
            <Textarea id="list-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's this list about?" rows={3} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!title.trim() || createList.isPending}>
              {createList.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
