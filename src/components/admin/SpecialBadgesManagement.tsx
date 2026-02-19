import { useState } from "react";
import { useAllSpecialBadges, useGrantSpecialBadge, useRevokeSpecialBadge, SPECIAL_BADGE_PRESETS } from "@/hooks/useSpecialBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SpecialBadgePill } from "@/components/social/SpecialBadge";

export function SpecialBadgesManagement() {
  const { user } = useAuth();
  const { data: allBadges = [], isLoading } = useAllSpecialBadges();
  const grant = useGrantSpecialBadge();
  const revoke = useRevokeSpecialBadge();

  const [targetUsername, setTargetUsername] = useState("");
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState(SPECIAL_BADGE_PRESETS[0].badge_type);
  const [customLabel, setCustomLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const preset = SPECIAL_BADGE_PRESETS.find(p => p.badge_type === selectedPreset) ?? SPECIAL_BADGE_PRESETS[0];

  const handleLookup = async () => {
    if (!targetUsername.trim()) return;
    setLookingUp(true);
    setLookupError("");
    setResolvedUserId(null);
    const { data, error } = await (supabase as any)
      .from("user_profiles")
      .select("user_id, display_name, username")
      .ilike("username", targetUsername.trim())
      .single();
    setLookingUp(false);
    if (error || !data) {
      setLookupError("User not found. Check the username and try again.");
      return;
    }
    setResolvedUserId(data.user_id);
    setResolvedName(data.display_name || data.username);
  };

  const handleGrant = () => {
    if (!resolvedUserId || !user?.id) return;
    grant.mutate({
      user_id: resolvedUserId,
      badge_type: preset.badge_type,
      badge_label: customLabel.trim() || preset.badge_label,
      badge_color: preset.badge_color,
      badge_icon: preset.badge_icon,
      granted_by: user.id,
      notes: notes.trim() || null,
    });
  };

  // Group badges by user for display
  const badgesByUser = allBadges.reduce<Record<string, typeof allBadges>>((acc, b) => {
    if (!acc[b.user_id]) acc[b.user_id] = [];
    acc[b.user_id].push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Grant new badge */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BadgeCheck className="h-4 w-4 text-primary" />
            Grant Special Badge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Username (exact match)"
              value={targetUsername}
              onChange={e => { setTargetUsername(e.target.value); setResolvedUserId(null); }}
              className="flex-1"
              onKeyDown={e => e.key === "Enter" && handleLookup()}
            />
            <Button variant="outline" onClick={handleLookup} disabled={lookingUp}>
              {lookingUp ? "Looking up…" : "Find User"}
            </Button>
          </div>

          {lookupError && <p className="text-sm text-destructive">{lookupError}</p>}
          {resolvedUserId && (
            <p className="text-sm text-muted-foreground">
              ✓ Found: <strong>{resolvedName}</strong>
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Badge Type</Label>
              <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPECIAL_BADGE_PRESETS.map(p => (
                    <SelectItem key={p.badge_type} value={p.badge_type}>
                      {p.badge_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Custom Label (optional)</Label>
              <Input
                placeholder={preset.badge_label}
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Internal Notes (optional)</Label>
            <Textarea
              placeholder="Why is this badge being granted?"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Preview:</span>
            <SpecialBadgePill
              badge={{
                badge_label: customLabel.trim() || preset.badge_label,
                badge_color: preset.badge_color,
                badge_icon: preset.badge_icon,
              }}
              size="sm"
            />
          </div>

          <Button
            onClick={handleGrant}
            disabled={!resolvedUserId || grant.isPending}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Grant Badge
          </Button>
        </CardContent>
      </Card>

      {/* Existing badges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Granted Badges</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : allBadges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No special badges granted yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(badgesByUser).map(([uid, badges]) => {
                const profile = (badges[0] as any).user_profiles;
                return (
                  <div key={uid} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {(profile?.display_name || profile?.username || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{profile?.display_name || profile?.username || uid.slice(0, 8)}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {badges.map(b => (
                          <div key={b.id} className="flex items-center gap-1">
                            <SpecialBadgePill badge={b} size="xs" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 text-destructive hover:text-destructive"
                              onClick={() => revoke.mutate(b.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
