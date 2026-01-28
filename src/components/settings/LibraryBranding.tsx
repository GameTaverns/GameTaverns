import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUpdateLibrarySettings } from "@/hooks/useLibrary";
import { useTenant } from "@/contexts/TenantContext";
import { LogoUpload } from "./LogoUpload";

export function LibraryBranding() {
  const { library, settings, refreshLibrary } = useTenant();
  const updateSettings = useUpdateLibrarySettings();
  const { toast } = useToast();
  
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);

  if (!library || !settings) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No library loaded
        </CardContent>
      </Card>
    );
  }

  const updateLocal = (key: string, value: string | null) => {
    setLocalSettings(prev => prev ? { ...prev, [key]: value } : prev);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!localSettings) return;
    
    try {
      await updateSettings.mutateAsync({
        libraryId: library.id,
        updates: localSettings,
      });
      
      await refreshLibrary();
      setHasChanges(false);
      
      toast({
        title: "Branding saved",
        description: "Your library branding has been updated",
      });
    } catch (error: any) {
      toast({
        title: "Failed to save branding",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const ls = localSettings || settings;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Branding</h2>
          <p className="text-muted-foreground">Customize your library's logo and background</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || updateSettings.isPending}
        >
          {updateSettings.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>
              Your library logo appears in the sidebar header
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogoUpload
              libraryId={library.id}
              currentLogoUrl={ls.logo_url}
              onLogoChange={(url) => updateLocal('logo_url', url)}
            />
          </CardContent>
        </Card>

        {/* Background Image */}
        <Card>
          <CardHeader>
            <CardTitle>Background Image</CardTitle>
            <CardDescription>
              Add a custom background to your library pages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Background Image URL</Label>
              <Input
                value={ls.background_image_url || ''}
                onChange={(e) => updateLocal('background_image_url', e.target.value || null)}
                placeholder="https://example.com/background.jpg"
              />
              <p className="text-sm text-muted-foreground">
                Enter a URL to an image. For best results, use a high-resolution image.
              </p>
            </div>
            
            {ls.background_image_url && (
              <div 
                className="h-40 rounded-md border bg-cover bg-center"
                style={{ backgroundImage: `url(${ls.background_image_url})` }}
              />
            )}
            
            <div className="space-y-2">
              <Label>Overlay Opacity</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[parseFloat(ls.background_overlay_opacity || '0.85') * 100]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => updateLocal('background_overlay_opacity', String(v / 100))}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">
                  {Math.round(parseFloat(ls.background_overlay_opacity || '0.85') * 100)}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Controls how much of the background is visible through the content overlay.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
