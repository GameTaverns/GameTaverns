import { useState, useEffect } from "react";
import { Palette, Image, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile, useUpdateUserProfile } from "@/hooks/useLibrary";

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
          <Slider value={[h]} min={0} max={360} step={1} onValueChange={([v]) => onChange(String(v), saturation, lightness)} className="flex-1" />
          <span className="text-xs w-8 text-right">{h}°</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-8">S</span>
          <Slider value={[s]} min={0} max={100} step={1} onValueChange={([v]) => onChange(hue, String(v), lightness)} className="flex-1" />
          <span className="text-xs w-8 text-right">{s}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-8">L</span>
          <Slider value={[l]} min={0} max={100} step={1} onValueChange={([v]) => onChange(hue, saturation, String(v))} className="flex-1" />
          <span className="text-xs w-8 text-right">{l}%</span>
        </div>
      </div>
    </div>
  );
}

const GRADIENT_PRESETS = [
  { label: "Ember", value: "linear-gradient(135deg, #b45309, #92400e)" },
  { label: "Ocean", value: "linear-gradient(135deg, #0369a1, #1e3a5f)" },
  { label: "Forest", value: "linear-gradient(135deg, #166534, #14532d)" },
  { label: "Twilight", value: "linear-gradient(135deg, #6d28d9, #4c1d95)" },
  { label: "Rust", value: "linear-gradient(135deg, #9a3412, #7c2d12)" },
  { label: "Midnight", value: "linear-gradient(135deg, #1e293b, #0f172a)" },
  { label: "Rose", value: "linear-gradient(135deg, #be185d, #9d174d)" },
  { label: "Slate", value: "linear-gradient(135deg, #334155, #1e293b)" },
];

type LocalSettings = {
  profile_primary_h: string;
  profile_primary_s: string;
  profile_primary_l: string;
  profile_accent_h: string;
  profile_accent_s: string;
  profile_accent_l: string;
  profile_background_h: string;
  profile_background_s: string;
  profile_background_l: string;
  profile_bg_image_url: string;
  profile_bg_opacity: string;
};

const DEFAULTS: LocalSettings = {
  profile_primary_h: "25",
  profile_primary_s: "35%",
  profile_primary_l: "30%",
  profile_accent_h: "35",
  profile_accent_s: "45%",
  profile_accent_l: "42%",
  profile_background_h: "30",
  profile_background_s: "20%",
  profile_background_l: "95%",
  profile_bg_image_url: "",
  profile_bg_opacity: "0.85",
};

export function ProfileThemeCustomizer() {
  const { data: profile } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const { toast } = useToast();

  const [localSettings, setLocalSettings] = useState<LocalSettings>(DEFAULTS);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local state from profile once it loads
  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    setLocalSettings({
      profile_primary_h: p.profile_primary_h ?? DEFAULTS.profile_primary_h,
      profile_primary_s: p.profile_primary_s ?? DEFAULTS.profile_primary_s,
      profile_primary_l: p.profile_primary_l ?? DEFAULTS.profile_primary_l,
      profile_accent_h: p.profile_accent_h ?? DEFAULTS.profile_accent_h,
      profile_accent_s: p.profile_accent_s ?? DEFAULTS.profile_accent_s,
      profile_accent_l: p.profile_accent_l ?? DEFAULTS.profile_accent_l,
      profile_background_h: p.profile_background_h ?? DEFAULTS.profile_background_h,
      profile_background_s: p.profile_background_s ?? DEFAULTS.profile_background_s,
      profile_background_l: p.profile_background_l ?? DEFAULTS.profile_background_l,
      profile_bg_image_url: p.profile_bg_image_url ?? DEFAULTS.profile_bg_image_url,
      profile_bg_opacity: p.profile_bg_opacity ?? DEFAULTS.profile_bg_opacity,
    });
    setHasChanges(false);
  }, [profile?.user_id ?? (profile as any)?.id]);

  if (!profile) return null;

  const ls = localSettings;

  const updateLocal = (key: keyof LocalSettings, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateColorLocal = (prefix: string, h: string, s: string, l: string) => {
    setLocalSettings(prev => ({
      ...prev,
      [`${prefix}_h`]: h,
      [`${prefix}_s`]: `${s}%`,
      [`${prefix}_l`]: `${l}%`,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync(ls);
      setHasChanges(false);
      toast({ title: "Profile theme saved" });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    }
  };

  const bgImageUrl = ls.profile_bg_image_url;
  const bgOpacity = parseFloat(ls.profile_bg_opacity) || 0.85;
  const isGradient = bgImageUrl?.startsWith("__gradient__");

  // Live preview
  const previewPrimary = `hsl(${ls.profile_primary_h}, ${ls.profile_primary_s}, ${ls.profile_primary_l})`;
  const previewAccent = `hsl(${ls.profile_accent_h}, ${ls.profile_accent_s}, ${ls.profile_accent_l})`;
  const previewBg = `hsl(${ls.profile_background_h}, ${ls.profile_background_s}, ${ls.profile_background_l})`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold">Profile Theme</h2>
          <p className="text-muted-foreground text-sm">Customize how your public profile looks</p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || updateProfile.isPending}>
          {updateProfile.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* Live Preview */}
      <div className="rounded-lg overflow-hidden border">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2 bg-muted/30 border-b">Live Preview</div>
        <div
          className="h-20 relative"
          style={
            isGradient
              ? { background: bgImageUrl.replace("__gradient__", "") }
              : bgImageUrl
              ? { backgroundImage: `url(${bgImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: `linear-gradient(135deg, ${previewPrimary}44, ${previewAccent}33)` }
          }
        >
          <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${1 - bgOpacity})` }} />
        </div>
        <div className="p-4 flex items-center gap-3" style={{ backgroundColor: previewBg }}>
          <div className="w-12 h-12 rounded-full border-4 border-white shadow" style={{ backgroundColor: previewPrimary }} />
          <div>
            <div className="font-bold text-sm" style={{ color: previewPrimary }}>
              {(profile as any).display_name || (profile as any).username}
            </div>
            <div className="text-xs" style={{ color: previewAccent }}>@{(profile as any).username}</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="colors">
        <TabsList>
          <TabsTrigger value="colors" className="gap-2">
            <Palette className="h-4 w-4" />Colors
          </TabsTrigger>
          <TabsTrigger value="background" className="gap-2">
            <Image className="h-4 w-4" />Background
          </TabsTrigger>
        </TabsList>

        <TabsContent value="colors" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Colors</CardTitle>
              <CardDescription>Choose your profile's primary and accent colors</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-8">
              <ColorPicker
                label="Primary Color"
                hue={ls.profile_primary_h}
                saturation={ls.profile_primary_s.replace("%", "")}
                lightness={ls.profile_primary_l.replace("%", "")}
                onChange={(h, s, l) => updateColorLocal("profile_primary", h, s, l)}
              />
              <ColorPicker
                label="Accent Color"
                hue={ls.profile_accent_h}
                saturation={ls.profile_accent_s.replace("%", "")}
                lightness={ls.profile_accent_l.replace("%", "")}
                onChange={(h, s, l) => updateColorLocal("profile_accent", h, s, l)}
              />
              <ColorPicker
                label="Background Tint"
                hue={ls.profile_background_h}
                saturation={ls.profile_background_s.replace("%", "")}
                lightness={ls.profile_background_l.replace("%", "")}
                onChange={(h, s, l) => updateColorLocal("profile_background", h, s, l)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="background" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gradient Presets</CardTitle>
              <CardDescription>Quick-pick a header gradient</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {GRADIENT_PRESETS.map((g) => (
                  <button
                    key={g.value}
                    className="h-12 rounded-md border-2 transition-all hover:scale-105 focus:outline-none"
                    style={{
                      background: g.value,
                      borderColor: bgImageUrl === `__gradient__${g.value}` ? "hsl(var(--primary))" : "transparent",
                    }}
                    title={g.label}
                    onClick={() => updateLocal("profile_bg_image_url", `__gradient__${g.value}`)}
                  />
                ))}
                <button
                  className="h-12 rounded-md border-2 border-dashed border-muted-foreground/30 text-xs text-muted-foreground hover:border-muted-foreground transition-colors"
                  onClick={() => updateLocal("profile_bg_image_url", "")}
                >
                  None
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom Image URL</CardTitle>
              <CardDescription>Paste a direct image URL to use as your profile header</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="https://example.com/image.jpg"
                value={isGradient ? "" : bgImageUrl}
                onChange={(e) => updateLocal("profile_bg_image_url", e.target.value)}
              />
              <div className="space-y-2">
                <Label>Content Overlay Opacity</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[bgOpacity * 100]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={([v]) => updateLocal("profile_bg_opacity", String(v / 100))}
                    className="flex-1"
                  />
                  <span className="text-sm w-10 text-right">{Math.round(bgOpacity * 100)}%</span>
                </div>
                <p className="text-xs text-muted-foreground">Higher = more overlay, less image visible. Lower = more image shows through.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
