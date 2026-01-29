import { useState, useEffect } from "react";
import { Loader2, Check, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useLibrary";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

// Discord brand color
const DISCORD_COLOR = "#5865F2";

// Discord logo SVG component
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

export function DiscordLinkCard() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const queryClient = useQueryClient();

  // Check for OAuth callback results
  useEffect(() => {
    const discordLinked = searchParams.get("discord_linked");
    const discordError = searchParams.get("discord_error");

    if (discordLinked === "true") {
      toast({
        title: "Discord Connected!",
        description: "Your Discord account has been linked. You'll now receive DM notifications.",
      });
      // Clear the query param
      searchParams.delete("discord_linked");
      setSearchParams(searchParams, { replace: true });
      // Refresh profile data
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    }

    if (discordError) {
      toast({
        title: "Discord Connection Failed",
        description: decodeURIComponent(discordError),
        variant: "destructive",
      });
      searchParams.delete("discord_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, queryClient]);

  const handleLinkDiscord = async () => {
    if (!user?.id) return;

    setIsLinking(true);
    try {
      // Fetch Discord config from edge function
      const { data, error } = await supabase.functions.invoke("discord-config");
      
      if (error || !data?.client_id) {
        throw new Error(error?.message || "Discord integration is not configured");
      }

      // Build state with user info and app origin for proper redirect
      const state = btoa(JSON.stringify({
        user_id: user.id,
        return_url: window.location.pathname + window.location.search,
        app_origin: window.location.origin,
      }));

      // Build OAuth URL
      const params = new URLSearchParams({
        client_id: data.client_id,
        redirect_uri: data.redirect_uri,
        response_type: "code",
        scope: "identify",
        state: state,
      });

      window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`;
    } catch (err: unknown) {
      toast({
        title: "Configuration Error",
        description: (err as Error).message || "Discord integration is not available",
        variant: "destructive",
      });
      setIsLinking(false);
    }
  };

  const handleUnlinkDiscord = async () => {
    setIsUnlinking(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const { error } = await supabase.functions.invoke("discord-unlink", {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Discord Disconnected",
        description: "Your Discord account has been unlinked.",
      });
      
      // Refresh profile data
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to unlink Discord account",
        variant: "destructive",
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  if (profileLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Type assertion for discord_user_id since it may not be in generated types yet
  const discordUserId = (profile as Record<string, unknown>)?.discord_user_id as string | null;
  const isLinked = !!discordUserId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DiscordIcon className="h-5 w-5" />
          Discord Integration
        </CardTitle>
        <CardDescription>
          Link your Discord account to receive direct message notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLinked ? (
          <>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <Check className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Discord Connected
                </p>
                <p className="text-xs text-muted-foreground">
                  Discord ID: {discordUserId}
                </p>
              </div>
            </div>
            
            <Alert>
              <AlertDescription className="text-sm">
                When someone sends you a message about a game, you'll receive a DM from our bot.
                Make sure you have DMs enabled from server members.
              </AlertDescription>
            </Alert>

            <Button
              variant="outline"
              onClick={handleUnlinkDiscord}
              disabled={isUnlinking}
              className="w-full"
            >
              {isUnlinking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Disconnect Discord
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <Alert>
              <AlertDescription className="text-sm">
                Connect your Discord account to receive private notifications as DMs.
                This is perfect for message alerts that shouldn't go to a public channel.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleLinkDiscord}
              disabled={isLinking}
              className="w-full"
              style={{ backgroundColor: DISCORD_COLOR }}
            >
              {isLinking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <DiscordIcon className="h-4 w-4 mr-2" />
                  Connect Discord
                  <ExternalLink className="h-3 w-3 ml-2" />
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
