import { useState, useEffect } from "react";
import { Loader2, Palette, Type, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ThemeSettings {
  theme_primary_h: string;
  theme_primary_s: string;
  theme_primary_l: string;
  theme_accent_h: string;
  theme_accent_s: string;
  theme_accent_l: string;
  theme_background_h: string;
  theme_background_s: string;
  theme_background_l: string;
  theme_card_h: string;
  theme_card_s: string;
  theme_card_l: string;
  theme_font_display: string;
  theme_font_body: string;
}

const DEFAULT_THEME: ThemeSettings = {
  theme_primary_h: "142",
  theme_primary_s: "35",
  theme_primary_l: "30",
  theme_accent_h: "18",
  theme_accent_s: "55",
  theme_accent_l: "50",
  theme_background_h: "39",
  theme_background_s: "45",
  theme_background_l: "94",
  theme_card_h: "40",
  theme_card_s: "50",
  theme_card_l: "96",
  theme_font_display: "MedievalSharp",
  theme_font_body: "IM Fell English",
};

// Validation helpers to prevent CSS injection
const validateHue = (value: number): number => {
  const num = Math.round(value);
  if (isNaN(num) || num < 0) return 0;
  if (num > 360) return 360;
  return num;
};

const validatePercent = (value: number): number => {
  const num = Math.round(value);
  if (isNaN(num) || num < 0) return 0;
  if (num > 100) return 100;
  return num;
};

// Sanitize string input - only allow alphanumeric, spaces, and basic punctuation
const sanitizeStringValue = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9\s\-_.]/g, '').slice(0, 100);
};

const DISPLAY_FONTS = [
  { value: "MedievalSharp", label: "MedievalSharp (Medieval)" },
  { value: "Cinzel", label: "Cinzel (Elegant)" },
  { value: "Playfair Display", label: "Playfair Display (Classic)" },
  { value: "Merriweather", label: "Merriweather (Traditional)" },
  { value: "Lora", label: "Lora (Literary)" },
];

const BODY_FONTS = [
  { value: "IM Fell English", label: "IM Fell English (Antiquarian)" },
  { value: "Lora", label: "Lora (Literary)" },
  { value: "Source Serif Pro", label: "Source Serif Pro (Modern Serif)" },
  { value: "Nunito", label: "Nunito (Friendly Sans)" },
  { value: "Open Sans", label: "Open Sans (Clean Sans)" },
];

export function ThemeCustomizer() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);

  useEffect(() => {
    fetchThemeSettings();
  }, []);

  // Apply theme preview in real-time
  useEffect(() => {
    applyThemePreview(theme);
  }, [theme]);

  const fetchThemeSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", Object.keys(DEFAULT_THEME));

      if (error) throw error;

      const settings: Partial<ThemeSettings> = {};
      data?.forEach((setting) => {
        if (setting.key in DEFAULT_THEME) {
          settings[setting.key as keyof ThemeSettings] = setting.value || "";
        }
      });

      setTheme({ ...DEFAULT_THEME, ...settings });
    } catch (error) {
      console.error("Error fetching theme settings:", error);
      toast({
        title: "Error",
        description: "Could not fetch theme settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyThemePreview = (settings: ThemeSettings) => {
    const root = document.documentElement;
    
    // Apply primary color
    root.style.setProperty("--primary", `${settings.theme_primary_h} ${settings.theme_primary_s}% ${settings.theme_primary_l}%`);
    root.style.setProperty("--ring", `${settings.theme_primary_h} ${settings.theme_primary_s}% ${settings.theme_primary_l}%`);
    root.style.setProperty("--forest", `${settings.theme_primary_h} ${settings.theme_primary_s}% ${settings.theme_primary_l}%`);
    
    // Apply accent color
    root.style.setProperty("--accent", `${settings.theme_accent_h} ${settings.theme_accent_s}% ${settings.theme_accent_l}%`);
    root.style.setProperty("--sienna", `${settings.theme_accent_h} ${settings.theme_accent_s}% ${settings.theme_accent_l}%`);
    
    // Apply background and card colors (only in light mode)
    if (!document.documentElement.classList.contains("dark")) {
      const bgL = Number(settings.theme_background_l);
      root.style.setProperty("--background", `${settings.theme_background_h} ${settings.theme_background_s}% ${settings.theme_background_l}%`);
      root.style.setProperty("--parchment", `${settings.theme_background_h} ${settings.theme_background_s}% ${bgL - 2}%`);
      // Apply card color from dedicated settings
      root.style.setProperty("--card", `${settings.theme_card_h} ${settings.theme_card_s}% ${settings.theme_card_l}%`);
      root.style.setProperty("--popover", `${settings.theme_card_h} ${settings.theme_card_s}% ${Math.min(Number(settings.theme_card_l) + 1, 100)}%`);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const [key, value] of Object.entries(theme)) {
        const { error } = await supabase
          .from("site_settings")
          .update({ value })
          .eq("key", key);

        if (error) throw error;
      }

      toast({
        title: "Theme saved",
        description: "Your theme customizations have been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not save theme settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setTheme(DEFAULT_THEME);
    toast({
      title: "Theme reset",
      description: "Preview updated. Save to apply defaults.",
    });
  };

  const updateColor = (prefix: "primary" | "accent" | "background" | "card", component: "h" | "s" | "l", value: number) => {
    // Validate input to prevent CSS injection
    const validatedValue = component === "h" ? validateHue(value) : validatePercent(value);
    setTheme((prev) => ({
      ...prev,
      [`theme_${prefix}_${component}`]: String(validatedValue),
    }));
  };

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Colors Section */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color Customization
          </CardTitle>
          <CardDescription>
            Customize your site's color palette. Changes are previewed in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Primary Color */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-border"
                style={{
                  backgroundColor: `hsl(${theme.theme_primary_h}, ${theme.theme_primary_s}%, ${theme.theme_primary_l}%)`,
                }}
              />
              <Label className="text-base font-medium">Primary Color</Label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Hue (0-360)</Label>
                <Slider
                  value={[Number(theme.theme_primary_h)]}
                  onValueChange={([v]) => updateColor("primary", "h", v)}
                  max={360}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_primary_h}
                  onChange={(e) => updateColor("primary", "h", Number(e.target.value))}
                  min={0}
                  max={360}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Saturation (%)</Label>
                <Slider
                  value={[Number(theme.theme_primary_s)]}
                  onValueChange={([v]) => updateColor("primary", "s", v)}
                  max={100}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_primary_s}
                  onChange={(e) => updateColor("primary", "s", Number(e.target.value))}
                  min={0}
                  max={100}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Lightness (%)</Label>
                <Slider
                  value={[Number(theme.theme_primary_l)]}
                  onValueChange={([v]) => updateColor("primary", "l", v)}
                  max={100}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_primary_l}
                  onChange={(e) => updateColor("primary", "l", Number(e.target.value))}
                  min={0}
                  max={100}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          {/* Accent Color */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-border"
                style={{
                  backgroundColor: `hsl(${theme.theme_accent_h}, ${theme.theme_accent_s}%, ${theme.theme_accent_l}%)`,
                }}
              />
              <Label className="text-base font-medium">Accent Color</Label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Hue (0-360)</Label>
                <Slider
                  value={[Number(theme.theme_accent_h)]}
                  onValueChange={([v]) => updateColor("accent", "h", v)}
                  max={360}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_accent_h}
                  onChange={(e) => updateColor("accent", "h", Number(e.target.value))}
                  min={0}
                  max={360}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Saturation (%)</Label>
                <Slider
                  value={[Number(theme.theme_accent_s)]}
                  onValueChange={([v]) => updateColor("accent", "s", v)}
                  max={100}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_accent_s}
                  onChange={(e) => updateColor("accent", "s", Number(e.target.value))}
                  min={0}
                  max={100}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Lightness (%)</Label>
                <Slider
                  value={[Number(theme.theme_accent_l)]}
                  onValueChange={([v]) => updateColor("accent", "l", v)}
                  max={100}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_accent_l}
                  onChange={(e) => updateColor("accent", "l", Number(e.target.value))}
                  min={0}
                  max={100}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-border"
                style={{
                  backgroundColor: `hsl(${theme.theme_background_h}, ${theme.theme_background_s}%, ${theme.theme_background_l}%)`,
                }}
              />
              <Label className="text-base font-medium">Background Color</Label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Hue (0-360)</Label>
                <Slider
                  value={[Number(theme.theme_background_h)]}
                  onValueChange={([v]) => updateColor("background", "h", v)}
                  max={360}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_background_h}
                  onChange={(e) => updateColor("background", "h", Number(e.target.value))}
                  min={0}
                  max={360}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Saturation (%)</Label>
                <Slider
                  value={[Number(theme.theme_background_s)]}
                  onValueChange={([v]) => updateColor("background", "s", v)}
                  max={100}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_background_s}
                  onChange={(e) => updateColor("background", "s", Number(e.target.value))}
                  min={0}
                  max={100}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Lightness (%)</Label>
                <Slider
                  value={[Number(theme.theme_background_l)]}
                  onValueChange={([v]) => updateColor("background", "l", v)}
                  max={100}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_background_l}
                  onChange={(e) => updateColor("background", "l", Number(e.target.value))}
                  min={0}
                  max={100}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          {/* Card Color */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-border"
                style={{
                  backgroundColor: `hsl(${theme.theme_card_h}, ${theme.theme_card_s}%, ${theme.theme_card_l}%)`,
                }}
              />
              <Label className="text-base font-medium">Card / Panel Color</Label>
            </div>
            <p className="text-xs text-muted-foreground">Controls cards, dialogs, and dropdown backgrounds (light mode only)</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Hue (0-360)</Label>
                <Slider
                  value={[Number(theme.theme_card_h)]}
                  onValueChange={([v]) => updateColor("card", "h", v)}
                  max={360}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_card_h}
                  onChange={(e) => updateColor("card", "h", Number(e.target.value))}
                  min={0}
                  max={360}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Saturation (%)</Label>
                <Slider
                  value={[Number(theme.theme_card_s)]}
                  onValueChange={([v]) => updateColor("card", "s", v)}
                  max={100}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_card_s}
                  onChange={(e) => updateColor("card", "s", Number(e.target.value))}
                  min={0}
                  max={100}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Lightness (%)</Label>
                <Slider
                  value={[Number(theme.theme_card_l)]}
                  onValueChange={([v]) => updateColor("card", "l", v)}
                  max={100}
                  step={1}
                />
                <Input
                  type="number"
                  value={theme.theme_card_l}
                  onChange={(e) => updateColor("card", "l", Number(e.target.value))}
                  min={0}
                  max={100}
                  className="h-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Typography Section */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Type className="h-5 w-5" />
            Typography
          </CardTitle>
          <CardDescription>
            Choose fonts for headings and body text
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Display Font (Headings)</Label>
              <Select
                value={theme.theme_font_display}
                onValueChange={(value) =>
                  setTheme((prev) => ({ ...prev, theme_font_display: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPLAY_FONTS.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p
                className="text-lg mt-2"
                style={{ fontFamily: theme.theme_font_display }}
              >
                Preview: The Quick Brown Fox
              </p>
            </div>

            <div className="space-y-2">
              <Label>Body Font (Text)</Label>
              <Select
                value={theme.theme_font_body}
                onValueChange={(value) =>
                  setTheme((prev) => ({ ...prev, theme_font_body: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BODY_FONTS.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p
                className="text-sm mt-2"
                style={{ fontFamily: theme.theme_font_body }}
              >
                Preview: The quick brown fox jumps over the lazy dog.
              </p>
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
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Note: Font changes require a page refresh to fully apply. Color changes preview in real-time.
      </p>
    </div>
  );
}
