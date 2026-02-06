import { useState, useEffect } from "react";
import { User, Mail, AtSign, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile, useUpdateUserProfile } from "@/hooks/useLibrary";
import { supabase, apiClient, isSelfHostedMode } from "@/integrations/backend/client";
import { DiscordLinkCard } from "./DiscordLinkCard";
import { TwoFactorSettings } from "./TwoFactorSettings";
import { FeaturedBadgeSelector } from "./FeaturedBadgeSelector";

export function AccountSettings() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
    }
  }, [profile]);

  // Validate username format and availability
  const validateUsername = async (value: string) => {
    if (!value) {
      setUsernameError(null);
      return true;
    }

    // Format validation: 3-30 chars, alphanumeric and underscores only
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(value)) {
      setUsernameError("Username must be 3-30 characters (letters, numbers, underscores only)");
      return false;
    }

    // Skip availability check if username hasn't changed
    if (value.toLowerCase() === profile?.username?.toLowerCase()) {
      setUsernameError(null);
      return true;
    }

    // Check availability
    setIsCheckingUsername(true);
    try {
      // Self-hosted mode: use API endpoint
      if (isSelfHostedMode()) {
        const result = await apiClient.get<{ available: boolean; reason?: string }>(
          `/profiles/check/username/${encodeURIComponent(value)}`
        );
        if (!result.available) {
          setUsernameError(result.reason || "This username is already taken");
          return false;
        }
        setUsernameError(null);
        return true;
      }
      
      // Supabase mode
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id")
        .ilike("username", value)
        .neq("user_id", user?.id || "")
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUsernameError("This username is already taken");
        return false;
      }

      setUsernameError(null);
      return true;
    } catch (error) {
      console.error("Error checking username:", error);
      setUsernameError("Could not verify username availability");
      return false;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    // Debounce the validation
    const timeoutId = setTimeout(() => validateUsername(value), 500);
    return () => clearTimeout(timeoutId);
  };

  const handleSave = async () => {
    // Validate username before saving
    const isValid = await validateUsername(username);
    if (!isValid) return;

    setIsSaving(true);
    try {
      await updateProfile.mutateAsync({
        display_name: displayName.trim() || null,
        username: username.trim().toLowerCase() || null,
        bio: bio.trim() || null,
      });

      toast({
        title: "Profile updated",
        description: "Your account settings have been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your display name, username, and bio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input
              id="email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Contact support to change your email address
            </p>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you want to be known"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              This is shown on your library and in messages
            </p>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username" className="flex items-center gap-2">
              <AtSign className="h-4 w-4" />
              Username
            </Label>
            <div className="relative">
              <Input
                id="username"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="your_username"
                maxLength={30}
                className={usernameError ? "border-destructive" : ""}
              />
              {isCheckingUsername && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {usernameError ? (
              <p className="text-xs text-destructive">{usernameError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                3-30 characters. Letters, numbers, and underscores only. You can use this to log in.
              </p>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Bio
            </Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us a bit about yourself..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {bio.length}/500 characters
            </p>
          </div>

          <Button 
            onClick={handleSave} 
            disabled={isSaving || !!usernameError || isCheckingUsername}
            className="w-full sm:w-auto"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Featured Achievement Badge */}
      <FeaturedBadgeSelector 
        currentBadgeId={profile?.featured_achievement_id || null}
        currentBadge={profile?.featured_achievement || null}
      />

      {/* Two-Factor Authentication */}
      <TwoFactorSettings />

      {/* Discord Integration */}
      <DiscordLinkCard />
    </div>
  );
}
