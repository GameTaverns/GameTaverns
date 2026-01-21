import { useState, useEffect } from "react";
import { Palette, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  DemoThemeSettings,
  DEFAULT_DEMO_THEME,
  loadDemoThemeSettings,
  saveDemoThemeSettings,
} from "@/hooks/useDemoSiteSettings";

const FONT_OPTIONS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Playfair Display",
  "Merriweather",
  "Source Sans Pro",
  "Poppins",
  "Nunito",
];

// Track loaded Google Fonts to avoid duplicate loading
const loadedFonts = new Set<string>();

/**
 * Dynamically load a Google Font if not already loaded
 */
function loadGoogleFont(fontName: string) {
  if (!fontName || loadedFonts.has(fontName)) return;
  
  const fontFamily = fontName.replace(/\s+/g, '+');
  const linkId = `google-font-${fontFamily}`;
  
  if (document.getElementById(linkId)) {
    loadedFonts.add(fontName);
    return;
  }
  
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
  loadedFonts.add(fontName);
}

export function DemoThemeCustomizer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<DemoThemeSettings>(DEFAULT_DEMO_THEME);
  const [isSaving, setIsSaving] = useState(false);

  // Load from session storage
  useEffect(() => {
    setTheme(loadDemoThemeSettings());
  }, []);

  // Apply theme preview in real-time
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", `${theme.primaryHue} ${theme.primarySaturation}% ${theme.primaryLightness}%`);
    root.style.setProperty("--ring", `${theme.primaryHue} ${theme.primarySaturation}% ${theme.primaryLightness}%`);
    root.style.setProperty("--forest", `${theme.primaryHue} ${theme.primarySaturation}% ${theme.primaryLightness}%`);
    root.style.setProperty("--accent", `${theme.accentHue} ${theme.accentSaturation}% ${theme.accentLightness}%`);
    root.style.setProperty("--sienna", `${theme.accentHue} ${theme.accentSaturation}% ${theme.accentLightness}%`);
    
    // Apply background and card colors in light mode
    if (!document.documentElement.classList.contains("dark")) {
      root.style.setProperty("--background", `${theme.backgroundHue} ${theme.backgroundSaturation}% ${theme.backgroundLightness}%`);
      root.style.setProperty("--parchment", `${theme.backgroundHue} ${theme.backgroundSaturation}% ${theme.backgroundLightness - 2}%`);
      // Card is slightly lighter than background
      root.style.setProperty("--card", `${theme.backgroundHue} ${Math.min(theme.backgroundSaturation + 5, 100)}% ${Math.min(theme.backgroundLightness + 2, 100)}%`);
      root.style.setProperty("--popover", `${theme.backgroundHue} ${theme.backgroundSaturation}% ${Math.min(theme.backgroundLightness + 3, 100)}%`);
    }
    
    // Load and apply fonts
    if (theme.displayFont) {
      loadGoogleFont(theme.displayFont);
      root.style.setProperty("--font-display", `"${theme.displayFont}"`);
    }
    if (theme.bodyFont) {
      loadGoogleFont(theme.bodyFont);
      root.style.setProperty("--font-body", `"${theme.bodyFont}"`);
    }
  }, [theme]);

  const updateTheme = (key: keyof DemoThemeSettings, value: number | string) => {
    setTheme((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    try {
      saveDemoThemeSettings(theme);
      window.dispatchEvent(new CustomEvent("demo-settings-updated"));
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({
        title: "Theme saved",
        description: "Theme settings have been saved to your demo session.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not save theme",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setTheme(DEFAULT_DEMO_THEME);
    saveDemoThemeSettings(DEFAULT_DEMO_THEME);
    window.dispatchEvent(new CustomEvent("demo-settings-updated"));
    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    toast({
      title: "Theme reset",
      description: "Theme settings have been reset to defaults.",
    });
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Theme Customization
        </CardTitle>
        <CardDescription>
          Customize colors and fonts for your site (demo mode - changes preview in real-time)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Color Customization */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Color Customization</h3>
          
          {/* Primary Color */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Primary Color</Label>
              <div 
                className="w-10 h-10 rounded-lg border shadow-sm"
                style={{ 
                  backgroundColor: `hsl(${theme.primaryHue}, ${theme.primarySaturation}%, ${theme.primaryLightness}%)`
                }}
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Hue</span>
                  <span>{theme.primaryHue}°</span>
                </div>
                <Slider
                  value={[theme.primaryHue]}
                  onValueChange={([v]) => updateTheme("primaryHue", v)}
                  min={0}
                  max={360}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Saturation</span>
                  <span>{theme.primarySaturation}%</span>
                </div>
                <Slider
                  value={[theme.primarySaturation]}
                  onValueChange={([v]) => updateTheme("primarySaturation", v)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Lightness</span>
                  <span>{theme.primaryLightness}%</span>
                </div>
                <Slider
                  value={[theme.primaryLightness]}
                  onValueChange={([v]) => updateTheme("primaryLightness", v)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </div>

          {/* Accent Color */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Accent Color</Label>
              <div 
                className="w-10 h-10 rounded-lg border shadow-sm"
                style={{ 
                  backgroundColor: `hsl(${theme.accentHue}, ${theme.accentSaturation}%, ${theme.accentLightness}%)`
                }}
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Hue</span>
                  <span>{theme.accentHue}°</span>
                </div>
                <Slider
                  value={[theme.accentHue]}
                  onValueChange={([v]) => updateTheme("accentHue", v)}
                  min={0}
                  max={360}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Saturation</span>
                  <span>{theme.accentSaturation}%</span>
                </div>
                <Slider
                  value={[theme.accentSaturation]}
                  onValueChange={([v]) => updateTheme("accentSaturation", v)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Lightness</span>
                  <span>{theme.accentLightness}%</span>
                </div>
                <Slider
                  value={[theme.accentLightness]}
                  onValueChange={([v]) => updateTheme("accentLightness", v)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Background Color</Label>
              <div 
                className="w-10 h-10 rounded-lg border shadow-sm"
                style={{ 
                  backgroundColor: `hsl(${theme.backgroundHue}, ${theme.backgroundSaturation}%, ${theme.backgroundLightness}%)`
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Only applies in light mode</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Hue</span>
                  <span>{theme.backgroundHue}°</span>
                </div>
                <Slider
                  value={[theme.backgroundHue]}
                  onValueChange={([v]) => updateTheme("backgroundHue", v)}
                  min={0}
                  max={360}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Saturation</span>
                  <span>{theme.backgroundSaturation}%</span>
                </div>
                <Slider
                  value={[theme.backgroundSaturation]}
                  onValueChange={([v]) => updateTheme("backgroundSaturation", v)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Lightness</span>
                  <span>{theme.backgroundLightness}%</span>
                </div>
                <Slider
                  value={[theme.backgroundLightness]}
                  onValueChange={([v]) => updateTheme("backgroundLightness", v)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Typography */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Typography</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Display Font</Label>
              <Select value={theme.displayFont} onValueChange={(v) => updateTheme("displayFont", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((font) => (
                    <SelectItem key={font} value={font}>{font}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for headings and titles</p>
            </div>
            <div className="space-y-2">
              <Label>Body Font</Label>
              <Select value={theme.bodyFont} onValueChange={(v) => updateTheme("bodyFont", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((font) => (
                    <SelectItem key={font} value={font}>{font}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for body text and paragraphs</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Theme"
            )}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
