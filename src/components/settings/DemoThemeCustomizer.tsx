import { useState, useEffect } from "react";
import { Palette, Loader2, Moon, Sun } from "lucide-react";
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

interface ColorSliderGroupProps {
  label: string;
  hue: number;
  saturation: number;
  lightness: number;
  onHueChange: (v: number) => void;
  onSaturationChange: (v: number) => void;
  onLightnessChange: (v: number) => void;
  description?: string;
}

function ColorSliderGroup({ 
  label, 
  hue, 
  saturation, 
  lightness, 
  onHueChange, 
  onSaturationChange, 
  onLightnessChange,
  description 
}: ColorSliderGroupProps) {
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">{label}</Label>
        <div 
          className="w-10 h-10 rounded-lg border shadow-sm"
          style={{ 
            backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`
          }}
        />
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Hue</span>
            <span>{hue}°</span>
          </div>
          <Slider
            value={[hue]}
            onValueChange={([v]) => onHueChange(v)}
            min={0}
            max={360}
            step={1}
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Saturation</span>
            <span>{saturation}%</span>
          </div>
          <Slider
            value={[saturation]}
            onValueChange={([v]) => onSaturationChange(v)}
            min={0}
            max={100}
            step={1}
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Lightness</span>
            <span>{lightness}%</span>
          </div>
          <Slider
            value={[lightness]}
            onValueChange={([v]) => onLightnessChange(v)}
            min={0}
            max={100}
            step={1}
          />
        </div>
      </div>
    </div>
  );
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
    const isDark = document.documentElement.classList.contains("dark");
    
    if (isDark) {
      // Dark mode - use dark-specific colors
      root.style.setProperty("--primary", `${theme.darkPrimaryHue} ${theme.darkPrimarySaturation}% ${theme.darkPrimaryLightness}%`);
      root.style.setProperty("--ring", `${theme.darkPrimaryHue} ${theme.darkPrimarySaturation}% ${theme.darkPrimaryLightness}%`);
      root.style.setProperty("--forest", `${theme.darkPrimaryHue} ${theme.darkPrimarySaturation}% ${theme.darkPrimaryLightness}%`);
      root.style.setProperty("--accent", `${theme.darkAccentHue} ${theme.darkAccentSaturation}% ${theme.darkAccentLightness}%`);
      root.style.setProperty("--sienna", `${theme.darkAccentHue} ${theme.darkAccentSaturation}% ${theme.darkAccentLightness}%`);
      root.style.setProperty("--background", `${theme.darkBackgroundHue} ${theme.darkBackgroundSaturation}% ${theme.darkBackgroundLightness}%`);
      root.style.setProperty("--card", `${theme.darkCardHue} ${theme.darkCardSaturation}% ${theme.darkCardLightness}%`);
      root.style.setProperty("--popover", `${theme.darkCardHue} ${theme.darkCardSaturation}% ${Math.min(theme.darkCardLightness + 2, 100)}%`);
      root.style.setProperty("--sidebar-background", `${theme.darkSidebarHue} ${theme.darkSidebarSaturation}% ${theme.darkSidebarLightness}%`);
    } else {
      // Light mode colors
      root.style.setProperty("--primary", `${theme.primaryHue} ${theme.primarySaturation}% ${theme.primaryLightness}%`);
      root.style.setProperty("--ring", `${theme.primaryHue} ${theme.primarySaturation}% ${theme.primaryLightness}%`);
      root.style.setProperty("--forest", `${theme.primaryHue} ${theme.primarySaturation}% ${theme.primaryLightness}%`);
      root.style.setProperty("--accent", `${theme.accentHue} ${theme.accentSaturation}% ${theme.accentLightness}%`);
      root.style.setProperty("--sienna", `${theme.accentHue} ${theme.accentSaturation}% ${theme.accentLightness}%`);
      root.style.setProperty("--background", `${theme.backgroundHue} ${theme.backgroundSaturation}% ${theme.backgroundLightness}%`);
      root.style.setProperty("--parchment", `${theme.backgroundHue} ${theme.backgroundSaturation}% ${theme.backgroundLightness - 2}%`);
      root.style.setProperty("--card", `${theme.cardHue} ${theme.cardSaturation}% ${theme.cardLightness}%`);
      root.style.setProperty("--popover", `${theme.cardHue} ${theme.cardSaturation}% ${Math.min(theme.cardLightness + 1, 100)}%`);
      root.style.setProperty("--sidebar-background", `${theme.sidebarHue} ${theme.sidebarSaturation}% ${theme.sidebarLightness}%`);
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
    <div className="space-y-6">
      {/* Light Mode Colors */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Sun className="h-5 w-5" />
            Light Mode Colors
          </CardTitle>
          <CardDescription>
            Customize colors for light mode (changes preview in real-time)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ColorSliderGroup
            label="Primary Color"
            hue={theme.primaryHue}
            saturation={theme.primarySaturation}
            lightness={theme.primaryLightness}
            onHueChange={(v) => updateTheme("primaryHue", v)}
            onSaturationChange={(v) => updateTheme("primarySaturation", v)}
            onLightnessChange={(v) => updateTheme("primaryLightness", v)}
          />

          <ColorSliderGroup
            label="Accent Color"
            hue={theme.accentHue}
            saturation={theme.accentSaturation}
            lightness={theme.accentLightness}
            onHueChange={(v) => updateTheme("accentHue", v)}
            onSaturationChange={(v) => updateTheme("accentSaturation", v)}
            onLightnessChange={(v) => updateTheme("accentLightness", v)}
          />

          <ColorSliderGroup
            label="Background Color"
            hue={theme.backgroundHue}
            saturation={theme.backgroundSaturation}
            lightness={theme.backgroundLightness}
            onHueChange={(v) => updateTheme("backgroundHue", v)}
            onSaturationChange={(v) => updateTheme("backgroundSaturation", v)}
            onLightnessChange={(v) => updateTheme("backgroundLightness", v)}
          />

          <ColorSliderGroup
            label="Card / Panel Color"
            hue={theme.cardHue}
            saturation={theme.cardSaturation}
            lightness={theme.cardLightness}
            onHueChange={(v) => updateTheme("cardHue", v)}
            onSaturationChange={(v) => updateTheme("cardSaturation", v)}
            onLightnessChange={(v) => updateTheme("cardLightness", v)}
            description="Controls cards, dialogs, and dropdown backgrounds"
          />

          <ColorSliderGroup
            label="Sidebar Color"
            hue={theme.sidebarHue}
            saturation={theme.sidebarSaturation}
            lightness={theme.sidebarLightness}
            onHueChange={(v) => updateTheme("sidebarHue", v)}
            onSaturationChange={(v) => updateTheme("sidebarSaturation", v)}
            onLightnessChange={(v) => updateTheme("sidebarLightness", v)}
            description="Controls the sidebar background"
          />
        </CardContent>
      </Card>

      {/* Dark Mode Colors */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Dark Mode Colors
          </CardTitle>
          <CardDescription>
            Customize colors specifically for dark mode
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ColorSliderGroup
            label="Primary Color"
            hue={theme.darkPrimaryHue}
            saturation={theme.darkPrimarySaturation}
            lightness={theme.darkPrimaryLightness}
            onHueChange={(v) => updateTheme("darkPrimaryHue", v)}
            onSaturationChange={(v) => updateTheme("darkPrimarySaturation", v)}
            onLightnessChange={(v) => updateTheme("darkPrimaryLightness", v)}
          />

          <ColorSliderGroup
            label="Accent Color"
            hue={theme.darkAccentHue}
            saturation={theme.darkAccentSaturation}
            lightness={theme.darkAccentLightness}
            onHueChange={(v) => updateTheme("darkAccentHue", v)}
            onSaturationChange={(v) => updateTheme("darkAccentSaturation", v)}
            onLightnessChange={(v) => updateTheme("darkAccentLightness", v)}
          />

          <ColorSliderGroup
            label="Background Color"
            hue={theme.darkBackgroundHue}
            saturation={theme.darkBackgroundSaturation}
            lightness={theme.darkBackgroundLightness}
            onHueChange={(v) => updateTheme("darkBackgroundHue", v)}
            onSaturationChange={(v) => updateTheme("darkBackgroundSaturation", v)}
            onLightnessChange={(v) => updateTheme("darkBackgroundLightness", v)}
          />

          <ColorSliderGroup
            label="Card / Panel Color"
            hue={theme.darkCardHue}
            saturation={theme.darkCardSaturation}
            lightness={theme.darkCardLightness}
            onHueChange={(v) => updateTheme("darkCardHue", v)}
            onSaturationChange={(v) => updateTheme("darkCardSaturation", v)}
            onLightnessChange={(v) => updateTheme("darkCardLightness", v)}
          />

          <ColorSliderGroup
            label="Sidebar Color"
            hue={theme.darkSidebarHue}
            saturation={theme.darkSidebarSaturation}
            lightness={theme.darkSidebarLightness}
            onHueChange={(v) => updateTheme("darkSidebarHue", v)}
            onSaturationChange={(v) => updateTheme("darkSidebarSaturation", v)}
            onLightnessChange={(v) => updateTheme("darkSidebarLightness", v)}
          />
        </CardContent>
      </Card>

      {/* Typography */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Typography
          </CardTitle>
          <CardDescription>
            Choose fonts for headings and body text
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
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
    </div>
  );
}
