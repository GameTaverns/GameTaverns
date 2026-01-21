import { useState, useEffect } from "react";
import { Loader2, Palette, Type, RotateCcw, Sun, Moon } from "lucide-react";
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
import { pb } from "@/integrations/pocketbase/client";
import { Collections, type SiteSetting } from "@/integrations/pocketbase/types";

interface ThemeSettings {
  // Light mode
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
  theme_sidebar_h: string;
  theme_sidebar_s: string;
  theme_sidebar_l: string;
  // Dark mode
  theme_dark_primary_h: string;
  theme_dark_primary_s: string;
  theme_dark_primary_l: string;
  theme_dark_accent_h: string;
  theme_dark_accent_s: string;
  theme_dark_accent_l: string;
  theme_dark_background_h: string;
  theme_dark_background_s: string;
  theme_dark_background_l: string;
  theme_dark_card_h: string;
  theme_dark_card_s: string;
  theme_dark_card_l: string;
  theme_dark_sidebar_h: string;
  theme_dark_sidebar_s: string;
  theme_dark_sidebar_l: string;
  // Typography
  theme_font_display: string;
  theme_font_body: string;
}

const DEFAULT_THEME: ThemeSettings = {
  // Light mode
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
  theme_sidebar_h: "25",
  theme_sidebar_s: "30",
  theme_sidebar_l: "20",
  // Dark mode
  theme_dark_primary_h: "142",
  theme_dark_primary_s: "35",
  theme_dark_primary_l: "45",
  theme_dark_accent_h: "18",
  theme_dark_accent_s: "55",
  theme_dark_accent_l: "60",
  theme_dark_background_h: "220",
  theme_dark_background_s: "15",
  theme_dark_background_l: "10",
  theme_dark_card_h: "220",
  theme_dark_card_s: "15",
  theme_dark_card_l: "15",
  theme_dark_sidebar_h: "220",
  theme_dark_sidebar_s: "20",
  theme_dark_sidebar_l: "8",
  // Typography
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
      const records = await pb.collection(Collections.SITE_SETTINGS).getFullList<SiteSetting>();
      
      const settings: Partial<ThemeSettings> = {};
      records.forEach((record) => {
        if (record.key in DEFAULT_THEME) {
          settings[record.key as keyof ThemeSettings] = record.value || "";
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
    const isDark = document.documentElement.classList.contains("dark");
    
    if (isDark) {
      // Dark mode colors - use dark-specific primary/accent
      root.style.setProperty("--primary", `${settings.theme_dark_primary_h} ${settings.theme_dark_primary_s}% ${settings.theme_dark_primary_l}%`);
      root.style.setProperty("--ring", `${settings.theme_dark_primary_h} ${settings.theme_dark_primary_s}% ${settings.theme_dark_primary_l}%`);
      root.style.setProperty("--forest", `${settings.theme_dark_primary_h} ${settings.theme_dark_primary_s}% ${settings.theme_dark_primary_l}%`);
      root.style.setProperty("--accent", `${settings.theme_dark_accent_h} ${settings.theme_dark_accent_s}% ${settings.theme_dark_accent_l}%`);
      root.style.setProperty("--sienna", `${settings.theme_dark_accent_h} ${settings.theme_dark_accent_s}% ${settings.theme_dark_accent_l}%`);
      root.style.setProperty("--background", `${settings.theme_dark_background_h} ${settings.theme_dark_background_s}% ${settings.theme_dark_background_l}%`);
      root.style.setProperty("--card", `${settings.theme_dark_card_h} ${settings.theme_dark_card_s}% ${settings.theme_dark_card_l}%`);
      root.style.setProperty("--popover", `${settings.theme_dark_card_h} ${settings.theme_dark_card_s}% ${Math.min(Number(settings.theme_dark_card_l) + 2, 100)}%`);
      root.style.setProperty("--sidebar-background", `${settings.theme_dark_sidebar_h} ${settings.theme_dark_sidebar_s}% ${settings.theme_dark_sidebar_l}%`);
    } else {
      // Light mode colors
      root.style.setProperty("--primary", `${settings.theme_primary_h} ${settings.theme_primary_s}% ${settings.theme_primary_l}%`);
      root.style.setProperty("--ring", `${settings.theme_primary_h} ${settings.theme_primary_s}% ${settings.theme_primary_l}%`);
      root.style.setProperty("--forest", `${settings.theme_primary_h} ${settings.theme_primary_s}% ${settings.theme_primary_l}%`);
      root.style.setProperty("--accent", `${settings.theme_accent_h} ${settings.theme_accent_s}% ${settings.theme_accent_l}%`);
      root.style.setProperty("--sienna", `${settings.theme_accent_h} ${settings.theme_accent_s}% ${settings.theme_accent_l}%`);
      const bgL = Number(settings.theme_background_l);
      root.style.setProperty("--background", `${settings.theme_background_h} ${settings.theme_background_s}% ${settings.theme_background_l}%`);
      root.style.setProperty("--parchment", `${settings.theme_background_h} ${settings.theme_background_s}% ${bgL - 2}%`);
      root.style.setProperty("--card", `${settings.theme_card_h} ${settings.theme_card_s}% ${settings.theme_card_l}%`);
      root.style.setProperty("--popover", `${settings.theme_card_h} ${settings.theme_card_s}% ${Math.min(Number(settings.theme_card_l) + 1, 100)}%`);
      root.style.setProperty("--sidebar-background", `${settings.theme_sidebar_h} ${settings.theme_sidebar_s}% ${settings.theme_sidebar_l}%`);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const [key, value] of Object.entries(theme)) {
        // Find existing setting by key
        const existing = await pb.collection(Collections.SITE_SETTINGS).getList<SiteSetting>(1, 1, {
          filter: `key = "${key}"`,
        });

        if (existing.items.length > 0) {
          await pb.collection(Collections.SITE_SETTINGS).update(existing.items[0].id, { value });
        } else {
          await pb.collection(Collections.SITE_SETTINGS).create({ key, value });
        }
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

  const updateColor = (prefix: "primary" | "accent" | "background" | "card" | "sidebar" | "dark_primary" | "dark_accent" | "dark_background" | "dark_card" | "dark_sidebar", component: "h" | "s" | "l", value: number) => {
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

  // Color control helper component
  const ColorControl = ({ 
    label, 
    prefix 
  }: { 
    label: string; 
    prefix: "primary" | "accent" | "background" | "card" | "sidebar" | "dark_primary" | "dark_accent" | "dark_background" | "dark_card" | "dark_sidebar";
  }) => {
    const h = theme[`theme_${prefix}_h` as keyof ThemeSettings];
    const s = theme[`theme_${prefix}_s` as keyof ThemeSettings];
    const l = theme[`theme_${prefix}_l` as keyof ThemeSettings];
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-border"
            style={{ backgroundColor: `hsl(${h}, ${s}%, ${l}%)` }}
          />
          <Label className="text-base font-medium">{label}</Label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Hue (0-360)</Label>
            <Slider
              value={[Number(h)]}
              onValueChange={([v]) => updateColor(prefix, "h", v)}
              max={360}
              step={1}
            />
            <Input
              type="number"
              value={h}
              onChange={(e) => updateColor(prefix, "h", Number(e.target.value))}
              min={0}
              max={360}
              className="h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Saturation (%)</Label>
            <Slider
              value={[Number(s)]}
              onValueChange={([v]) => updateColor(prefix, "s", v)}
              max={100}
              step={1}
            />
            <Input
              type="number"
              value={s}
              onChange={(e) => updateColor(prefix, "s", Number(e.target.value))}
              min={0}
              max={100}
              className="h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Lightness (%)</Label>
            <Slider
              value={[Number(l)]}
              onValueChange={([v]) => updateColor(prefix, "l", v)}
              max={100}
              step={1}
            />
            <Input
              type="number"
              value={l}
              onChange={(e) => updateColor(prefix, "l", Number(e.target.value))}
              min={0}
              max={100}
              className="h-8"
            />
          </div>
        </div>
      </div>
    );
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
            Customize your site's light mode color palette. Changes are previewed in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <ColorControl label="Primary Color" prefix="primary" />
          <ColorControl label="Accent Color" prefix="accent" />
          <ColorControl label="Background Color" prefix="background" />
          <ColorControl label="Card Color" prefix="card" />
          <ColorControl label="Sidebar Color" prefix="sidebar" />
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
            Customize your site's dark mode color palette.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <ColorControl label="Primary Color" prefix="dark_primary" />
          <ColorControl label="Accent Color" prefix="dark_accent" />
          <ColorControl label="Background Color" prefix="dark_background" />
          <ColorControl label="Card Color" prefix="dark_card" />
          <ColorControl label="Sidebar Color" prefix="dark_sidebar" />
        </CardContent>
      </Card>

      {/* Typography */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Type className="h-5 w-5" />
            Typography
          </CardTitle>
          <CardDescription>
            Choose fonts for headings and body text.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Display Font (Headings)</Label>
              <Select
                value={theme.theme_font_display}
                onValueChange={(v) => setTheme(prev => ({ ...prev, theme_font_display: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPLAY_FONTS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: theme.theme_font_display }}>
                Preview: The quick brown fox
              </p>
            </div>
            <div className="space-y-2">
              <Label>Body Font (Text)</Label>
              <Select
                value={theme.theme_font_body}
                onValueChange={(v) => setTheme(prev => ({ ...prev, theme_font_body: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BODY_FONTS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: theme.theme_font_body }}>
                Preview: The quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={handleReset} disabled={isSaving}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Palette className="h-4 w-4 mr-2" />
              Save Theme
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
