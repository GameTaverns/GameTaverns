import { useState, useEffect } from "react";
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export function BGGSyncSettings() {
  const { library } = useTenant();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [bggUsername, setBggUsername] = useState("");
  const [syncFrequency, setSyncFrequency] = useState("off");
  const [removalBehavior, setRemovalBehavior] = useState("flag");
  const [syncCollection, setSyncCollection] = useState(true);
  const [syncPlays, setSyncPlays] = useState(false);
  const [syncWishlist, setSyncWishlist] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch current settings
  const { data: syncSettings, isLoading } = useQuery({
    queryKey: ["bgg-sync-settings", library?.id],
    queryFn: async () => {
      if (!library?.id) return null;
      const { data, error } = await supabase
        .from("library_settings")
        .select(
          "bgg_username, bgg_sync_enabled, bgg_sync_frequency, bgg_sync_removal_behavior, bgg_sync_collection, bgg_sync_plays, bgg_sync_wishlist, bgg_last_synced_at, bgg_last_sync_status, bgg_last_sync_message"
        )
        .eq("library_id", library.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!library?.id,
  });

  // Populate form when settings load
  useEffect(() => {
    if (syncSettings) {
      setBggUsername(syncSettings.bgg_username || "");
      setSyncFrequency(syncSettings.bgg_sync_frequency || "off");
      setRemovalBehavior(syncSettings.bgg_sync_removal_behavior || "flag");
      setSyncCollection(syncSettings.bgg_sync_collection !== false);
      setSyncPlays(syncSettings.bgg_sync_plays === true);
      setSyncWishlist(syncSettings.bgg_sync_wishlist === true);
    }
  }, [syncSettings]);

  // Save settings
  const handleSave = async () => {
    if (!library?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("library_settings")
        .update({
          bgg_username: bggUsername.trim() || null,
          bgg_sync_enabled: syncFrequency !== "off",
          bgg_sync_frequency: syncFrequency,
          bgg_sync_removal_behavior: removalBehavior,
          bgg_sync_collection: syncCollection,
          bgg_sync_plays: syncPlays,
          bgg_sync_wishlist: syncWishlist,
        })
        .eq("library_id", library.id);

      if (error) throw error;

      toast({ title: "BGG sync settings saved" });
      queryClient.invalidateQueries({ queryKey: ["bgg-sync-settings"] });
    } catch (err) {
      toast({
        title: "Failed to save settings",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Manual sync trigger
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!library?.id || !session?.access_token) throw new Error("Not authenticated");

      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL || window.__RUNTIME_CONFIG__?.SUPABASE_URL || ""}`;
      const anonKey = `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || window.__RUNTIME_CONFIG__?.SUPABASE_ANON_KEY || ""}`;

      const res = await fetch(`${baseUrl}/functions/v1/bgg-sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ library_id: library.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sync failed");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "BGG Sync Complete",
        description: data.message || "Your library has been synced with BGG.",
      });
      queryClient.invalidateQueries({ queryKey: ["bgg-sync-settings"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["library-games"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Sync Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const lastSynced = syncSettings?.bgg_last_synced_at;
  const lastStatus = syncSettings?.bgg_last_sync_status;
  const lastMessage = syncSettings?.bgg_last_sync_message;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            BGG Collection Sync
          </CardTitle>
          <CardDescription>
            Automatically keep your library in sync with your BoardGameGeek collection.
            New games on BGG will be added here, and you can choose what happens when games are removed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* BGG Username */}
          <div className="space-y-2">
            <Label htmlFor="bgg-username">BGG Username</Label>
            <Input
              id="bgg-username"
              value={bggUsername}
              onChange={(e) => setBggUsername(e.target.value)}
              placeholder="Your BoardGameGeek username"
            />
            <p className="text-xs text-muted-foreground">
              This is the username you use to log in to boardgamegeek.com
            </p>
          </div>

          {/* Sync Frequency */}
          <div className="space-y-2">
            <Label>Auto-Sync Frequency</Label>
            <Select value={syncFrequency} onValueChange={setSyncFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off (manual only)</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often to automatically check BGG for collection changes
            </p>
          </div>

          {/* Removal Behavior */}
          <div className="space-y-2">
            <Label>When games are removed from BGG</Label>
            <Select value={removalBehavior} onValueChange={setRemovalBehavior}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flag">Keep in library (flag only)</SelectItem>
                <SelectItem value="remove">Auto-remove from library</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sync Scope Toggles */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">What to sync</Label>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Collection</p>
                <p className="text-xs text-muted-foreground">Owned games, metadata, and images</p>
              </div>
              <Switch checked={syncCollection} onCheckedChange={setSyncCollection} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Play History</p>
                <p className="text-xs text-muted-foreground">Import play sessions and player data from BGG</p>
              </div>
              <Switch checked={syncPlays} onCheckedChange={setSyncPlays} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Wishlist</p>
                <p className="text-xs text-muted-foreground">Add BGG wishlist items as "coming soon"</p>
              </div>
              <Switch checked={syncWishlist} onCheckedChange={setSyncWishlist} />
            </div>
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Sync Status & Manual Trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sync Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastSynced ? (
            <div className="flex items-start gap-3">
              {lastStatus === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              ) : lastStatus === "error" ? (
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              ) : (
                <Clock className="h-5 w-5 text-accent-foreground mt-0.5 shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    Last synced {formatDistanceToNow(new Date(lastSynced), { addSuffix: true })}
                  </p>
                  <Badge variant={lastStatus === "success" ? "default" : lastStatus === "error" ? "destructive" : "secondary"}>
                    {lastStatus}
                  </Badge>
                </div>
                {lastMessage && (
                  <p className="text-xs text-muted-foreground mt-1">{lastMessage}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sync has been performed yet.</p>
          )}

          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !bggUsername.trim()}
            variant="outline"
            className="w-full"
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {syncMutation.isPending ? "Syncing..." : "Sync Now"}
          </Button>

          {!bggUsername.trim() && (
            <p className="text-xs text-muted-foreground text-center">
              Enter your BGG username above to enable syncing
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
