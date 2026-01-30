import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface PlatformSetting {
  key: string;
  value: string | null;
}

const SETTING_KEYS = [
  { key: "platform_name", label: "Platform Name", type: "text", description: "The name of your platform" },
  { key: "platform_tagline", label: "Tagline", type: "text", description: "A short description for the platform" },
  { key: "support_email", label: "Support Email", type: "email", description: "Contact email for support" },
  { key: "maintenance_mode", label: "Maintenance Mode", type: "boolean", description: "Enable to show maintenance page to users" },
  { key: "allow_signups", label: "Allow New Signups", type: "boolean", description: "Allow new users to register" },
  { key: "max_libraries_per_user", label: "Max Libraries Per User", type: "number", description: "Maximum number of libraries a user can create" },
  { key: "announcement_banner", label: "Announcement Banner", type: "textarea", description: "Show an announcement to all users" },
];

export function PlatformSettings() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value");

      if (error) throw error;

      // Convert to map
      const settingsMap: Record<string, string> = {};
      (data || []).forEach((setting) => {
        settingsMap[setting.key] = setting.value || "";
      });

      setLocalSettings(settingsMap);
      return settingsMap;
    },
  });

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      // Upsert the setting
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key, value }, { onConflict: "key" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      toast.success("Setting saved");
    },
    onError: () => {
      toast.error("Failed to save setting");
    },
  });

  const handleChange = (key: string, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (key: string) => {
    updateSettingMutation.mutate({ key, value: localSettings[key] || "" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        {SETTING_KEYS.map((setting) => (
          <Card key={setting.key} className="bg-wood-medium/20 border-wood-medium/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-cream text-base">{setting.label}</CardTitle>
              <CardDescription className="text-cream/60">{setting.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {setting.type === "boolean" ? (
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={localSettings[setting.key] === "true"}
                      onCheckedChange={(checked) => {
                        const value = checked ? "true" : "false";
                        handleChange(setting.key, value);
                        updateSettingMutation.mutate({ key: setting.key, value });
                      }}
                    />
                    <span className="text-cream/70">
                      {localSettings[setting.key] === "true" ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                ) : setting.type === "textarea" ? (
                  <div className="flex-1 space-y-2">
                    <Textarea
                      value={localSettings[setting.key] || ""}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                      className="bg-wood-dark/50 border-wood-medium/50 text-cream"
                      rows={3}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSave(setting.key)}
                      disabled={updateSettingMutation.isPending}
                      className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                    >
                      {updateSettingMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      type={setting.type}
                      value={localSettings[setting.key] || ""}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                      className="bg-wood-dark/50 border-wood-medium/50 text-cream flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSave(setting.key)}
                      disabled={updateSettingMutation.isPending}
                      className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                    >
                      {updateSettingMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
