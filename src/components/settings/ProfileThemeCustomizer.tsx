import { useState } from "react";
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
        className="w-full h-10 rounded-md border"
        style={{ backgroundColor: `hsl(${h}, ${s}%, ${l}%)` }}
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs w-6">H</span>
          <Slider value={[h]} min={0} max={360} step={1} onValueChange={([v]) => onChange(String(v), saturation, lightness)} className="flex-1" />
          <span className="text-xs w-8 text-right">{h}°</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-6">S</span>
          <Slider value={[s]} min={0} max={100} step={1} onValueChange={([v]) => onChange(hue, String(v), lightness)} className="flex-1" />
          <span className="text-xs w-8 text-right">{s}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-6">L</span>
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

export function ProfileThemeCustomizer() {
  const { data: profile } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const { toast } = useToast();

  const [local, setLocal] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  if (!profile) return null;

  const get = (key: string, fallback: string) =>
    key in local ? local[key] : ((profile as any)[key] ?? fallback);

  const set = (key: string, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const setColor = (prefix: string, h: string, s: string, l: string) => {
    setLocal((prev) => ({
      ...prev,
      [`${prefix}_h`]: h,
      [`${prefix}_s`]: `${s}%`,
      [`${prefix}_l`]: `${l}%`,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync(local as any);
      setHasChanges(false);
      toast({ title: "Profile theme saved" });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    }
  };

  const bgImageUrl = get("profile_bg_image_url", "");
  const bgOpacity = parseFloat(get("profile_bg_opacity", "0.85"));
  const isGradient = bgImageUrl?.startsWith("__gradient__");

  // Live preview style
  const previewPrimary = `hsl(${get("profile_primary_h", "25")}, ${get("profile_primary_s", "35%")}, ${get("profile_primary_l", "30%")})`;
  const previewAccent = `hsl(${get("profile_accent_h", "35")}, ${get("profile_accent_s", "45%")}, ${get("profile_accent_l", "42%")})`;
  const previewBg = `hsl(${get("profile_background_h", "30")}, ${get("profile_background_s", "20%")}, ${get("profile_background_l", "95%")})`;

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
            <div className="font-bold text-sm" style={{ color: `hsl(${get("profile_primary_h","25")}, ${get("profile_primary_s","35%")}, 15%)` }}>
              {profile.display_name || profile.username}
            </div>
            <div className="text-xs" style={{ color: previewAccent }}>@{profile.username}</div>
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
                hue={get("profile_primary_h", "25")}
                saturation={get("profile_primary_s", "35%").replace("%", "")}
                lightness={get("profile_primary_l", "30%").replace("%", "")}
                onChange={(h, s, l) => setColor("profile_primary", h, s, l)}
              />
              <ColorPicker
                label="Accent Color"
                hue={get("profile_accent_h", "35")}
                saturation={get("profile_accent_s", "45%").replace("%", "")}
                lightness={get("profile_accent_l", "42%").replace("%", "")}
                onChange={(h, s, l) => setColor("profile_accent", h, s, l)}
              />
              <ColorPicker
                label="Background Tint"
                hue={get("profile_background_h", "30")}
                saturation={get("profile_background_s", "20%").replace("%", "")}
                lightness={get("profile_background_l", "95%").replace("%", "")}
                onChange={(h, s, l) => setColor("profile_background", h, s, l)}
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
                    onClick={() => set("profile_bg_image_url", `__gradient__${g.value}`)}
                  />
                ))}
                <button
                  className="h-12 rounded-md border-2 border-dashed border-muted-foreground/30 text-xs text-muted-foreground hover:border-muted-foreground transition-colors"
                  onClick={() => set("profile_bg_image_url", "")}
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
                onChange={(e) => set("profile_bg_image_url", e.target.value)}
              />
              <div className="space-y-2">
                <Label>Content Overlay Opacity</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[bgOpacity * 100]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={([v]) => set("profile_bg_opacity", String(v / 100))}
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
