import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUpdateLibrary, useUpdateLibrarySettings } from "@/hooks/useLibrary";
import { useTenant } from "@/contexts/TenantContext";

export function LibrarySettingsGeneral() {
  const { library, settings, refreshLibrary } = useTenant();
  const updateLibrary = useUpdateLibrary();
  const updateSettings = useUpdateLibrarySettings();
  const { toast } = useToast();
  
  const [name, setName] = useState(library?.name || '');
  const [description, setDescription] = useState(library?.description || '');
  const [footerText, setFooterText] = useState(settings?.footer_text || '');
  const [contactEmail, setContactEmail] = useState(settings?.contact_email || '');
  const [twitterHandle, setTwitterHandle] = useState(settings?.twitter_handle || '');
  const [instagramUrl, setInstagramUrl] = useState(settings?.instagram_url || '');
  const [facebookUrl, setFacebookUrl] = useState(settings?.facebook_url || '');
  const [discordUrl, setDiscordUrl] = useState(settings?.discord_url || '');
  
  // Feature flags
  const [featurePlayLogs, setFeaturePlayLogs] = useState(settings?.feature_play_logs ?? true);
  const [featureWishlist, setFeatureWishlist] = useState(settings?.feature_wishlist ?? true);
  const [featureForSale, setFeatureForSale] = useState(settings?.feature_for_sale ?? true);
  const [featureMessaging, setFeatureMessaging] = useState(settings?.feature_messaging ?? true);
  const [featureComingSoon, setFeatureComingSoon] = useState(settings?.feature_coming_soon ?? true);
  const [featureRatings, setFeatureRatings] = useState(settings?.feature_ratings ?? true);
  
  const [isSaving, setIsSaving] = useState(false);
  
  if (!library || !settings) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No library loaded
        </CardContent>
      </Card>
    );
  }
  
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Update library info
      await updateLibrary.mutateAsync({
        libraryId: library.id,
        updates: { name, description },
      });
      
      // Update settings
      await updateSettings.mutateAsync({
        libraryId: library.id,
        updates: {
          footer_text: footerText,
          contact_email: contactEmail,
          twitter_handle: twitterHandle,
          instagram_url: instagramUrl,
          facebook_url: facebookUrl,
          discord_url: discordUrl,
          feature_play_logs: featurePlayLogs,
          feature_wishlist: featureWishlist,
          feature_for_sale: featureForSale,
          feature_messaging: featureMessaging,
          feature_coming_soon: featureComingSoon,
          feature_ratings: featureRatings,
        },
      });
      
      await refreshLibrary();
      
      toast({
        title: "Settings saved",
        description: "Your library settings have been updated",
      });
    } catch (error: any) {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Library Settings</h2>
          <p className="text-muted-foreground">Configure your library details and features</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
      
      <div className="grid gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Your library name and description</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Library Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Board Game Collection"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A collection of my favorite board games..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Library URL</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <span className="font-mono text-sm">
                  {library.slug}.gametaverns.com
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Library URLs cannot be changed after creation.
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>Enable or disable library features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Play Logging</Label>
                <p className="text-sm text-muted-foreground">Track game sessions and plays</p>
              </div>
              <Switch checked={featurePlayLogs} onCheckedChange={setFeaturePlayLogs} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Wishlist</Label>
                <p className="text-sm text-muted-foreground">Let visitors mark games they want to play</p>
              </div>
              <Switch checked={featureWishlist} onCheckedChange={setFeatureWishlist} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>For Sale Section</Label>
                <p className="text-sm text-muted-foreground">List games you're selling</p>
              </div>
              <Switch checked={featureForSale} onCheckedChange={setFeatureForSale} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Messaging</Label>
                <p className="text-sm text-muted-foreground">Allow visitors to send you messages</p>
              </div>
              <Switch checked={featureMessaging} onCheckedChange={setFeatureMessaging} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Coming Soon</Label>
                <p className="text-sm text-muted-foreground">Show games you're expecting</p>
              </div>
              <Switch checked={featureComingSoon} onCheckedChange={setFeatureComingSoon} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Ratings</Label>
                <p className="text-sm text-muted-foreground">Allow visitors to rate games</p>
              </div>
              <Switch checked={featureRatings} onCheckedChange={setFeatureRatings} />
            </div>
          </CardContent>
        </Card>
        
        {/* Contact & Social */}
        <Card>
          <CardHeader>
            <CardTitle>Contact & Social</CardTitle>
            <CardDescription>How visitors can reach you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Twitter Handle</Label>
                <Input
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value)}
                  placeholder="@username"
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram URL</Label>
                <Input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Facebook URL</Label>
                <Input
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Discord URL</Label>
                <Input
                  value={discordUrl}
                  onChange={(e) => setDiscordUrl(e.target.value)}
                  placeholder="https://discord.gg/..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Footer Text</Label>
              <Input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="© 2026 My Collection"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
