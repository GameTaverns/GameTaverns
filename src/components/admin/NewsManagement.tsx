import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Newspaper, Plus, Rss, CheckCircle, XCircle, Clock, Eye, Loader2, Trash2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NewsSource {
  id: string;
  name: string;
  slug: string;
  source_type: string;
  feed_url: string | null;
  website_url: string | null;
  logo_url: string | null;
  is_trusted: boolean;
  is_enabled: boolean;
  fetch_interval_minutes: number;
  last_fetched_at: string | null;
  last_error: string | null;
  created_at: string;
}

function SourcesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [sourceType, setSourceType] = useState("rss");
  const [isTrusted, setIsTrusted] = useState(false);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["admin-news-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_sources")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as NewsSource[];
    },
  });

  const addSource = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("news_sources").insert({
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        source_type: sourceType,
        feed_url: feedUrl || null,
        website_url: websiteUrl || null,
        is_trusted: isTrusted,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-news-sources"] });
      toast({ title: "Source added" });
      setShowAdd(false);
      setName(""); setSlug(""); setFeedUrl(""); setWebsiteUrl("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleSource = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase.from("news_sources").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-news-sources"] }),
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("news_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-news-sources"] });
      toast({ title: "Source deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">News Sources ({sources.length})</h3>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Source
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Trusted</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead>Last Fetch</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map(s => (
            <TableRow key={s.id}>
              <TableCell>
                <div>
                  <span className="font-medium text-foreground">{s.name}</span>
                  {s.feed_url && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{s.feed_url}</p>}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{s.source_type}</Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={s.is_trusted}
                  onCheckedChange={v => toggleSource.mutate({ id: s.id, field: "is_trusted", value: v })}
                />
              </TableCell>
              <TableCell>
                <Switch
                  checked={s.is_enabled}
                  onCheckedChange={v => toggleSource.mutate({ id: s.id, field: "is_enabled", value: v })}
                />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {s.last_fetched_at ? formatDistanceToNow(new Date(s.last_fetched_at), { addSuffix: true }) : "Never"}
                {s.last_error && <p className="text-destructive truncate max-w-[150px]">{s.last_error}</p>}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => deleteSource.mutate(s.id)} className="h-8 w-8 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add News Source</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. BoardGameGeek News" /></div>
            <div><Label>Slug</Label><Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="auto-generated from name" /></div>
            <div>
              <Label>Source Type</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rss">RSS Feed</SelectItem>
                  <SelectItem value="scrape">Web Scrape</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Feed URL</Label><Input value={feedUrl} onChange={e => setFeedUrl(e.target.value)} placeholder="https://..." /></div>
            <div><Label>Website URL</Label><Input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://..." /></div>
            <div className="flex items-center gap-2">
              <Switch checked={isTrusted} onCheckedChange={setIsTrusted} />
              <Label>Trusted (auto-publish)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => addSource.mutate()} disabled={!name || addSource.isPending}>
              {addSource.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModerationTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["admin-pending-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("id, title, slug, summary, image_url, author_name, published_at, status, source_url, created_at, source:news_sources(name)")
        .in("status", ["pending"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const moderate = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "published" | "rejected" }) => {
      const { error } = await supabase.from("news_articles").update({
        status: action,
        moderated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-articles"] });
      toast({ title: action === "published" ? "Article approved" : "Article rejected" });
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">Moderation Queue ({pending.length})</h3>
      {pending.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="h-8 w-8 text-primary/50 mx-auto mb-2" />
          <p className="text-muted-foreground">All clear — no articles pending review</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((article: any) => (
            <Card key={article.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{article.title}</h4>
                    {article.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{article.summary}</p>}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{article.source?.name || "Unknown source"}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(article.created_at), { addSuffix: true })}</span>
                      {article.source_url && (
                        <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          View original
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => moderate.mutate({ id: article.id, action: "published" })}
                      disabled={moderate.isPending}
                      className="gap-1"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => moderate.mutate({ id: article.id, action: "rejected" })}
                      disabled={moderate.isPending}
                      className="gap-1"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewsManagement() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Newspaper className="h-6 w-6 text-primary" />
        <h2 className="font-display text-xl font-bold text-foreground">News Management</h2>
      </div>

      <Tabs defaultValue="moderation" className="w-full">
        <TabsList>
          <TabsTrigger value="moderation">Moderation Queue</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>
        <TabsContent value="moderation"><ModerationTab /></TabsContent>
        <TabsContent value="sources"><SourcesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
