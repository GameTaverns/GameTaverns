import { useState } from "react";
import { Save, Loader2, MessageSquare, TestTube, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useUpdateLibrarySettings } from "@/hooks/useLibrary";
import { useTenant } from "@/contexts/TenantContext";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";

interface DiscordNotifications {
  game_added: boolean;
  wishlist_vote: boolean;
  message_received: boolean;
  poll_created: boolean;
  poll_closed: boolean;
}

const DEFAULT_NOTIFICATIONS: DiscordNotifications = {
  game_added: true,
  wishlist_vote: true,
  message_received: true,
  poll_created: true,
  poll_closed: true,
};

export function LibraryDiscordSettings() {
  const { library, settings, refreshLibrary } = useTenant();
  const updateSettings = useUpdateLibrarySettings();
  const { toast } = useToast();

  // Access new Discord fields via type assertion since they may not be in generated types yet
  const settingsAny = settings as unknown as Record<string, unknown>;
  
  const [webhookUrl, setWebhookUrl] = useState(
    (settingsAny?.discord_webhook_url as string) || ""
  );
  const [eventsChannelId, setEventsChannelId] = useState(
    (settingsAny?.discord_events_channel_id as string) || ""
  );
  const [notifications, setNotifications] = useState<DiscordNotifications>(() => {
    const saved = settingsAny?.discord_notifications as DiscordNotifications | null;
    return saved ? { ...DEFAULT_NOTIFICATIONS, ...saved } : DEFAULT_NOTIFICATIONS;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  if (!library || !settings) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No library loaded
        </CardContent>
      </Card>
    );
  }

  const isValidWebhookUrl = (url: string) => {
    return url === "" || url.startsWith("https://discord.com/api/webhooks/") || url.startsWith("https://discordapp.com/api/webhooks/");
  };

  const handleSave = async () => {
    if (!isValidWebhookUrl(webhookUrl)) {
      toast({
        title: "Invalid webhook URL",
        description: "Please enter a valid Discord webhook URL",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings.mutateAsync({
        libraryId: library.id,
        updates: {
          discord_webhook_url: webhookUrl || null,
          discord_events_channel_id: eventsChannelId || null,
          discord_notifications: notifications,
        } as Record<string, unknown>,
      });

      await refreshLibrary();
      toast({
        title: "Discord settings saved",
        description: "Your notification preferences have been updated",
      });
    } catch (error: unknown) {
      toast({
        title: "Failed to save settings",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl || !isValidWebhookUrl(webhookUrl)) {
      toast({
        title: "Invalid webhook URL",
        description: "Please enter a valid Discord webhook URL first",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const { error } = await supabase.functions.invoke("discord-notify", {
        body: {
          library_id: library.id,
          event_type: "game_added",
          data: {
            title: "Test Game",
            player_count: "2-4 players",
            play_time: "45-60 minutes",
            image_url: "https://cf.geekdo-images.com/thumb/img/VZIh1F9X2u1FDe-f9svHpqTMSYQ=/fit-in/200x150/pic2649952.jpg",
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Test notification sent!",
        description: "Check your Discord channel for the test message",
      });
    } catch (error: unknown) {
      toast({
        title: "Test failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const updateNotification = (key: keyof DiscordNotifications, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Discord Integration</h2>
          <p className="text-muted-foreground">
            Get notified in Discord when things happen in your library
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Webhook URL */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Webhook URL
            </CardTitle>
            <CardDescription>
              Create a webhook in your Discord server and paste the URL here
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Discord Webhook URL</Label>
              <Input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className={!isValidWebhookUrl(webhookUrl) ? "border-destructive" : ""}
              />
              {!isValidWebhookUrl(webhookUrl) && (
                <p className="text-sm text-destructive">
                  URL must start with https://discord.com/api/webhooks/
                </p>
              )}
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                <strong>How to create a webhook:</strong>
                <ol className="list-decimal ml-4 mt-2 space-y-1">
                  <li>Open Discord and go to your server</li>
                  <li>Right-click a channel → Edit Channel → Integrations</li>
                  <li>Click "Webhooks" → "New Webhook"</li>
                  <li>Name it (e.g., "GameTaverns") and copy the URL</li>
                </ol>
                <a
                  href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-primary hover:underline"
                >
                  Discord Webhook Guide <ExternalLink className="h-3 w-3" />
                </a>
              </AlertDescription>
            </Alert>

            <Button
              variant="outline"
              onClick={handleTestWebhook}
              disabled={isTesting || !webhookUrl}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Send Test Notification
            </Button>
          </CardContent>
        </Card>

        {/* Events Forum Channel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Events Forum Channel
            </CardTitle>
            <CardDescription>
              Post calendar events (game nights, polls) to a Discord forum channel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Forum Channel ID</Label>
              <Input
                type="text"
                value={eventsChannelId}
                onChange={(e) => setEventsChannelId(e.target.value)}
                placeholder="e.g., 1234567890123456789"
              />
              <p className="text-sm text-muted-foreground">
                The bot will create forum threads for game night polls and calendar events
              </p>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                <strong>How to get a forum channel ID:</strong>
                <ol className="list-decimal ml-4 mt-2 space-y-1">
                  <li>Enable Developer Mode in Discord (User Settings → App Settings → Advanced)</li>
                  <li>Right-click your forum channel and select "Copy Channel ID"</li>
                  <li>Make sure the bot has "Send Messages" and "Create Public Threads" permissions in that channel</li>
                </ol>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Types</CardTitle>
            <CardDescription>
              Choose which events trigger Discord notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>New Game Added</Label>
                <p className="text-sm text-muted-foreground">
                  When you add a new game to your library
                </p>
              </div>
              <Switch
                checked={notifications.game_added}
                onCheckedChange={(v) => updateNotification("game_added", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Wishlist Votes</Label>
                <p className="text-sm text-muted-foreground">
                  When someone wants to play a game
                </p>
              </div>
              <Switch
                checked={notifications.wishlist_vote}
                onCheckedChange={(v) => updateNotification("wishlist_vote", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Messages Received</Label>
                <p className="text-sm text-muted-foreground">
                  When someone sends you a message about a game
                  <span className="block text-xs text-primary mt-1">
                    → Sent as Discord DM (requires linked account in Account Settings)
                  </span>
                </p>
              </div>
              <Switch
                checked={notifications.message_received}
                onCheckedChange={(v) => updateNotification("message_received", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Poll Created</Label>
                <p className="text-sm text-muted-foreground">
                  When a new poll is created (shareable link)
                </p>
              </div>
              <Switch
                checked={notifications.poll_created}
                onCheckedChange={(v) => updateNotification("poll_created", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Poll Closed</Label>
                <p className="text-sm text-muted-foreground">
                  When a poll ends with results
                </p>
              </div>
              <Switch
                checked={notifications.poll_closed}
                onCheckedChange={(v) => updateNotification("poll_closed", v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
