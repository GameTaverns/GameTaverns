import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSelfHostedSupabaseStack } from "@/integrations/backend/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { 
  ToggleRight, 
  History, 
  Heart, 
  DollarSign, 
  MessageSquare, 
  Clock,
  Save,
  RefreshCw,
  Star,
  Calendar,
  Trophy,
  BookOpen,
  Info
} from "lucide-react";

interface LibraryFeatureFlags {
  playLogs: boolean;
  wishlist: boolean;
  forSale: boolean;
  messaging: boolean;
  comingSoon: boolean;
  ratings: boolean;
  events: boolean;
  achievements: boolean;
  lending: boolean;
}

const FEATURE_FLAG_ICONS: Record<keyof LibraryFeatureFlags, React.ComponentType<{ className?: string }>> = {
  playLogs: History,
  wishlist: Heart,
  forSale: DollarSign,
  messaging: MessageSquare,
  comingSoon: Clock,
  ratings: Star,
  events: Calendar,
  achievements: Trophy,
  lending: BookOpen,
};

const FEATURE_FLAG_LABELS: Record<keyof LibraryFeatureFlags, string> = {
  playLogs: "Play Logs",
  wishlist: "Wishlist / Voting",
  forSale: "For Sale",
  messaging: "Messaging",
  comingSoon: "Coming Soon",
  ratings: "Ratings",
  events: "Events Calendar",
  achievements: "Achievements",
  lending: "Game Lending",
};

const FEATURE_FLAG_DESCRIPTIONS: Record<keyof LibraryFeatureFlags, string> = {
  playLogs: "Track game sessions and play history",
  wishlist: "Allow guests to vote for games they want to play",
  forSale: "Show games that are for sale with pricing",
  messaging: "Allow visitors to send messages about games",
  comingSoon: "Show upcoming games that aren't available yet",
  ratings: "Allow visitors to rate games (5-star system)",
  events: "Show upcoming events and calendar to visitors",
  achievements: "Show achievements and badges for library engagement",
  lending: "Allow registered users to request game loans. When enabled, your library will appear in the public directory under 'Lending Libraries'.",
};

// Features that affect directory visibility
const DIRECTORY_VISIBLE_FEATURES: Array<keyof LibraryFeatureFlags> = ["lending"];

const FEATURE_FLAG_DB_KEYS: Record<keyof LibraryFeatureFlags, string> = {
  playLogs: "feature_play_logs",
  wishlist: "feature_wishlist",
  forSale: "feature_for_sale",
  messaging: "feature_messaging",
  comingSoon: "feature_coming_soon",
  ratings: "feature_ratings",
  events: "feature_events",
  achievements: "feature_achievements",
  lending: "feature_lending",
};

export function LibraryFeatureFlagsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { library, settings, refreshLibrary } = useTenant();
  const [localFlags, setLocalFlags] = useState<LibraryFeatureFlags>({
    playLogs: true,
    wishlist: true,
    forSale: true,
    messaging: true,
    comingSoon: true,
    ratings: true,
    events: true,
    achievements: true,
    lending: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialFlags, setInitialFlags] = useState<LibraryFeatureFlags | null>(null);

  // Load settings from tenant context
  useEffect(() => {
    if (settings) {
      const flags: LibraryFeatureFlags = {
        playLogs: settings.feature_play_logs ?? true,
        wishlist: settings.feature_wishlist ?? true,
        forSale: settings.feature_for_sale ?? true,
        messaging: settings.feature_messaging ?? true,
        comingSoon: settings.feature_coming_soon ?? true,
        ratings: settings.feature_ratings ?? true,
        events: settings.feature_events ?? true,
        achievements: settings.feature_achievements ?? true,
        lending: settings.feature_lending ?? true,
      };
      setLocalFlags(flags);
      setInitialFlags(flags);
    }
  }, [settings]);

  // Track changes
  useEffect(() => {
    if (initialFlags) {
      const changed = Object.keys(localFlags).some(
        (key) => localFlags[key as keyof LibraryFeatureFlags] !== initialFlags[key as keyof LibraryFeatureFlags]
      );
      setHasChanges(changed);
    }
  }, [localFlags, initialFlags]);

  const handleToggle = (flagKey: keyof LibraryFeatureFlags) => {
    setLocalFlags((prev) => ({
      ...prev,
      [flagKey]: !prev[flagKey],
    }));
  };

  const handleSave = async () => {
    if (!library?.id) return;
    
    setIsSaving(true);
    
    try {
      // Build update object
      const updateData: Record<string, boolean> = {};
      (Object.keys(FEATURE_FLAG_DB_KEYS) as Array<keyof LibraryFeatureFlags>).forEach((flagKey) => {
        updateData[FEATURE_FLAG_DB_KEYS[flagKey]] = localFlags[flagKey];
      });
      
      // Sync allow_lending with feature_lending for directory visibility
      updateData.allow_lending = localFlags.lending;
      
       if (isSelfHostedSupabaseStack()) {
         // Self-hosted Supabase stack: use backend function (service role) to avoid RLS/PostgREST issues
         const { error } = await supabase.functions.invoke("library-settings", {
           body: { ...updateData, libraryId: library.id },
         });
         if (error) throw error;
       } else {
        // Cloud: use Supabase
        const { data: updatedSettings, error } = await supabase
          .from("library_settings")
          .update(updateData)
          .eq("library_id", library.id)
          .select("library_id")
          .single();

        if (error) throw error;
        if (!updatedSettings) {
          throw new Error("Save was blocked (missing permission). Please re-login and try again.");
        }
      }
      
      // Refresh tenant context
      await refreshLibrary();
      
      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ["library-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["tenant"] });
      
      setInitialFlags(localFlags);
      
      toast({
        title: "Features updated",
        description: "Feature settings have been saved successfully.",
      });
      
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving feature flags:", error);
      toast({
        title: "Error",
        description: "Failed to save feature settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (initialFlags) {
      setLocalFlags(initialFlags);
    }
  };

  if (!library || !settings) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ToggleRight className="h-5 w-5 text-primary" />
            <CardTitle>Feature Flags</CardTitle>
          </div>
          {hasChanges && (
            <Badge variant="secondary" className="animate-pulse">
              Unsaved changes
            </Badge>
          )}
        </div>
        <CardDescription>
          Enable or disable features for your library. Visitors will only see features that are enabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Directory Visibility:</strong> Some features (like Game Lending) make your library discoverable in the public directory when enabled. 
            To hide your library from the directory entirely, visit the <strong>General</strong> tab and disable "Show in Directory".
          </AlertDescription>
        </Alert>
        {(Object.keys(FEATURE_FLAG_ICONS) as Array<keyof LibraryFeatureFlags>).map((flagKey) => {
          const Icon = FEATURE_FLAG_ICONS[flagKey];
          
          return (
            <div
              key={flagKey}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor={flagKey} className="text-base font-medium">
                    {FEATURE_FLAG_LABELS[flagKey]}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {FEATURE_FLAG_DESCRIPTIONS[flagKey]}
                  </p>
                </div>
              </div>
              <Switch
                id={flagKey}
                checked={localFlags[flagKey]}
                onCheckedChange={() => handleToggle(flagKey)}
              />
            </div>
          );
        })}

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
