import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { 
  FeatureFlags, 
  FEATURE_FLAG_LABELS, 
  FEATURE_FLAG_DESCRIPTIONS 
} from "@/hooks/useFeatureFlags";
import { 
  Settings2, 
  History, 
  Heart, 
  DollarSign, 
  MessageSquare, 
  Clock,
  Save,
  RefreshCw,
  Lock
} from "lucide-react";

const FEATURE_FLAG_ICONS: Record<keyof FeatureFlags, React.ComponentType<{ className?: string }>> = {
  playLogs: History,
  wishlist: Heart,
  forSale: DollarSign,
  messaging: MessageSquare,
  comingSoon: Clock,
};

const FEATURE_FLAG_DB_KEYS: Record<keyof FeatureFlags, string> = {
  playLogs: "feature_play_logs",
  wishlist: "feature_wishlist",
  forSale: "feature_for_sale",
  messaging: "feature_messaging",
  comingSoon: "feature_coming_soon",
};

// Check if env var is explicitly set
function isEnvLocked(flagKey: keyof FeatureFlags): boolean {
  const envKeys: Record<keyof FeatureFlags, string> = {
    playLogs: "VITE_FEATURE_PLAY_LOGS",
    wishlist: "VITE_FEATURE_WISHLIST",
    forSale: "VITE_FEATURE_FOR_SALE",
    messaging: "VITE_FEATURE_MESSAGING",
    comingSoon: "VITE_FEATURE_COMING_SOON",
  };
  
  const value = import.meta.env[envKeys[flagKey]];
  return value !== undefined && value !== "";
}

interface FeatureFlagsAdminProps {
  currentFlags: FeatureFlags;
}

export function FeatureFlagsAdmin({ currentFlags }: FeatureFlagsAdminProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localFlags, setLocalFlags] = useState<FeatureFlags>(currentFlags);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state with prop changes
  useEffect(() => {
    setLocalFlags(currentFlags);
  }, [currentFlags]);

  // Track changes
  useEffect(() => {
    const changed = Object.keys(localFlags).some(
      (key) => localFlags[key as keyof FeatureFlags] !== currentFlags[key as keyof FeatureFlags]
    );
    setHasChanges(changed);
  }, [localFlags, currentFlags]);

  const handleToggle = (flagKey: keyof FeatureFlags) => {
    if (isEnvLocked(flagKey)) {
      toast({
        title: "Feature locked",
        description: "This feature is controlled by an environment variable and cannot be changed at runtime.",
        variant: "destructive",
      });
      return;
    }
    
    setLocalFlags((prev) => ({
      ...prev,
      [flagKey]: !prev[flagKey],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Update each flag in the database
      const updates = Object.entries(localFlags).map(([key, value]) => {
        const dbKey = FEATURE_FLAG_DB_KEYS[key as keyof FeatureFlags];
        return supabase
          .from("site_settings")
          .upsert({ key: dbKey, value: String(value) }, { onConflict: "key" });
      });
      
      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      
      if (errors.length > 0) {
        throw new Error("Failed to save some settings");
      }
      
      // Invalidate queries to refresh
      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      
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
    setLocalFlags(currentFlags);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <CardTitle>Feature Flags</CardTitle>
          </div>
          {hasChanges && (
            <Badge variant="secondary" className="animate-pulse">
              Unsaved changes
            </Badge>
          )}
        </div>
        <CardDescription>
          Enable or disable features across the platform. Features locked by environment variables 
          are shown with a lock icon and cannot be changed at runtime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {(Object.keys(localFlags) as Array<keyof FeatureFlags>).map((flagKey) => {
          const Icon = FEATURE_FLAG_ICONS[flagKey];
          const locked = isEnvLocked(flagKey);
          
          return (
            <div
              key={flagKey}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={flagKey} className="text-base font-medium">
                      {FEATURE_FLAG_LABELS[flagKey]}
                    </Label>
                    {locked && (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {FEATURE_FLAG_DESCRIPTIONS[flagKey]}
                  </p>
                </div>
              </div>
              <Switch
                id={flagKey}
                checked={localFlags[flagKey]}
                onCheckedChange={() => handleToggle(flagKey)}
                disabled={locked}
                className={locked ? "opacity-50" : ""}
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
