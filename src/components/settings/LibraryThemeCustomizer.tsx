import { useState } from "react";
import { Palette, Type, Image, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUpdateLibrarySettings } from "@/hooks/useLibrary";
import { useTenant } from "@/contexts/TenantContext";

const FONT_OPTIONS = [
  { value: "Cinzel", label: "Cinzel (Medieval)" },
  { value: "Playfair Display", label: "Playfair Display (Elegant)" },
  { value: "Merriweather", label: "Merriweather (Classic)" },
  { value: "Roboto Slab", label: "Roboto Slab (Modern)" },
  { value: "Oswald", label: "Oswald (Bold)" },
  { value: "Lora", label: "Lora (Readable)" },
  { value: "Inter", label: "Inter (Clean)" },
  { value: "Source Sans 3", label: "Source Sans (Professional)" },
];

interface ColorPickerProps {
  label: string;
  hue: string;
  saturation: string;
  lightness: string;
  onChange: (h: string, s: string, l: string) => void;
}

function ColorPicker({ label, hue, saturation, lightness, onChange }: ColorPickerProps) {
  const h = parseInt(hue) || 0;
  const s = parseInt(saturation) || 50;
  const l = parseInt(lightness) || 50;
  
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      <div 
        className="w-full h-12 rounded-md border"
        style={{ backgroundColor: `hsl(${h}, ${s}%, ${l}%)` }}
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs w-8">H</span>
          <Slider
            value={[h]}
            min={0}
            max={360}
            step={1}
            onValueChange={([v]) => onChange(String(v), saturation, lightness)}
            className="flex-1"
          />
          <span className="text-xs w-8 text-right">{h}°</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-8">S</span>
          <Slider
            value={[s]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => onChange(hue, String(v), lightness)}
            className="flex-1"
          />
          <span className="text-xs w-8 text-right">{s}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-8">L</span>
          <Slider
            value={[l]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => onChange(hue, saturation, String(v))}
            className="flex-1"
          />
          <span className="text-xs w-8 text-right">{l}%</span>
        </div>
      </div>
    </div>
  );
}

export function LibraryThemeCustomizer() {
  const { library, settings, refreshLibrary } = useTenant();
  const updateSettings = useUpdateLibrarySettings();
  const { toast } = useToast();
  
  // Local state for unsaved changes
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
  
  const updateLocal = (key: string, value: string) => {
    setLocalSettings(prev => prev ? { ...prev, [key]: value } : prev);
    setHasChanges(true);
  };
  
  const updateColorLocal = (prefix: string, h: string, s: string, l: string) => {
    setLocalSettings(prev => prev ? {
      ...prev,
      [`${prefix}_h`]: h,
      [`${prefix}_s`]: `${s}%`,
      [`${prefix}_l`]: `${l}%`,
    } : prev);
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
        title: "Theme saved",
        description: "Your library theme has been updated",
      });
    } catch (error: any) {
      toast({
        title: "Failed to save theme",
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
          <h2 className="text-2xl font-display font-bold">Theme Customization</h2>
          <p className="text-muted-foreground">Personalize your library's appearance</p>
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
      
      <Tabs defaultValue="colors">
        <TabsList>
          <TabsTrigger value="colors" className="gap-2">
            <Palette className="h-4 w-4" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="typography" className="gap-2">
            <Type className="h-4 w-4" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="background" className="gap-2">
            <Image className="h-4 w-4" />
            Background
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="colors" className="mt-6">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Light Mode */}
            <Card>
              <CardHeader>
                <CardTitle>Light Mode</CardTitle>
                <CardDescription>Colors for light theme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ColorPicker
                  label="Primary Color"
                  hue={ls.theme_primary_h}
                  saturation={ls.theme_primary_s.replace('%', '')}
                  lightness={ls.theme_primary_l.replace('%', '')}
                  onChange={(h, s, l) => updateColorLocal('theme_primary', h, s, l)}
                />
                <ColorPicker
                  label="Accent Color"
                  hue={ls.theme_accent_h}
                  saturation={ls.theme_accent_s.replace('%', '')}
                  lightness={ls.theme_accent_l.replace('%', '')}
                  onChange={(h, s, l) => updateColorLocal('theme_accent', h, s, l)}
                />
                <ColorPicker
                  label="Background"
                  hue={ls.theme_background_h}
                  saturation={ls.theme_background_s.replace('%', '')}
                  lightness={ls.theme_background_l.replace('%', '')}
                  onChange={(h, s, l) => updateColorLocal('theme_background', h, s, l)}
                />
                <ColorPicker
                  label="Card Background"
                  hue={ls.theme_card_h}
                  saturation={ls.theme_card_s.replace('%', '')}
                  lightness={ls.theme_card_l.replace('%', '')}
                  onChange={(h, s, l) => updateColorLocal('theme_card', h, s, l)}
                />
                <ColorPicker
                  label="Sidebar"
                  hue={ls.theme_sidebar_h}
                  saturation={ls.theme_sidebar_s.replace('%', '')}
                  lightness={ls.theme_sidebar_l.replace('%', '')}
                  onChange={(h, s, l) => updateColorLocal('theme_sidebar', h, s, l)}
                />
              </CardContent>
            </Card>
            
            {/* Dark Mode */}
            <Card>
              <CardHeader>
                <CardTitle>Dark Mode</CardTitle>
                <CardDescription>Colors for dark theme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ColorPicker
                  label="Primary Color"
                  hue={ls.theme_dark_primary_h}
                  saturation={ls.theme_dark_primary_s.replace('%', '')}
                  lightness={ls.theme_dark_primary_l.replace('%', '')}
                  onChange={(h, s, l) => updateColorLocal('theme_dark_primary', h, s, l)}
                />
                <ColorPicker
                  label="Accent Color"
                  hue={ls.theme_dark_accent_h}
                  saturation={ls.theme_dark_accent_s.replace('%', '')}
                  lightness={ls.theme_dark_accent_l.replace('%', '')}
                  onChange={(h, s, l) => updateColorLocal('theme_dark_accent', h, s, l)}
                />
                <ColorPicker
                  label="Background"
                  hue={ls.theme_dark_background_h}
                  saturation={ls.theme_dark_background_s.replace('%', '')}
                  lightness={ls.theme_dark_background_l.replace('%', '')}
                  onChange={(h, s, l) => updateColorLocal('theme_dark_background', h, s, l)}
                />
                <ColorPicker
                  label="Card Background"
                  hue={ls.theme_dark_card_h}
                  saturation={ls.theme_dark_card_s.replace('%', '')}
                  lightness={ls.theme_dark_card_l.replace('%', '')}
                  onChange={(h, s, l) => updateColorLocal('theme_dark_card', h, s, l)}
                />
                <ColorPicker
                  label="Sidebar"
                  hue={ls.theme_dark_sidebar_h}
                  saturation={ls.theme_dark_sidebar_s.replace('%', '')}
                  lightness={ls.theme_dark_sidebar_l.replace('%', '')}
                  onChange={(h, s, l) => updateColorLocal('theme_dark_sidebar', h, s, l)}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="typography" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Fonts</CardTitle>
              <CardDescription>Choose fonts for your library</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Display Font (Headings)</Label>
                  <Select
                    value={ls.theme_font_display}
                    onValueChange={(v) => updateLocal('theme_font_display', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map(font => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div 
                    className="p-4 border rounded-md text-2xl"
                    style={{ fontFamily: ls.theme_font_display }}
                  >
                    The Quick Brown Fox
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Body Font (Text)</Label>
                  <Select
                    value={ls.theme_font_body}
                    onValueChange={(v) => updateLocal('theme_font_body', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map(font => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div 
                    className="p-4 border rounded-md"
                    style={{ fontFamily: ls.theme_font_body }}
                  >
                    The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="background" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Background Image</CardTitle>
              <CardDescription>Add a custom background to your library</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Background Image URL</Label>
                <Input
                  value={ls.background_image_url || ''}
                  onChange={(e) => updateLocal('background_image_url', e.target.value)}
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
                    value={[parseFloat(ls.background_overlay_opacity) * 100]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={([v]) => updateLocal('background_overlay_opacity', String(v / 100))}
                    className="flex-1"
                  />
                  <span className="text-sm w-12 text-right">
                    {Math.round(parseFloat(ls.background_overlay_opacity) * 100)}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Controls how much of the background is visible through the content overlay.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
