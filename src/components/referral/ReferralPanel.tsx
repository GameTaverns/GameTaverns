import { useState } from "react";
import { useMyReferral, REFERRAL_TIERS, FOUNDING_MEMBER_BADGE } from "@/hooks/useReferral";
import { ReferralBadges } from "@/components/referral/ReferralBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Copy, Check, Users, Zap, Trophy, Crown, Beer, Megaphone, Sword } from "lucide-react";
import { toast } from "sonner";

const TIER_ICONS = {
  has_tavern_regular: Beer,
  has_town_crier: Megaphone,
  has_guild_founder: Sword,
  has_legend: Crown,
};

export function ReferralPanel() {
  const {
    referrals,
    badges,
    activeCode,
    referralUrl,
    confirmedCount,
    nextTier,
    progressToNext,
    isLoading,
    generateCode,
  } = useMyReferral();

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = () => {
    generateCode.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Your referral link */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Your Referral Link
          </CardTitle>
          <CardDescription>
            Share this link to invite friends. You'll earn badges when they sign up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {referralUrl ? (
            <div className="flex gap-2">
              <Input value={referralUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <Button onClick={handleGenerate} disabled={generateCode.isPending} className="gap-2">
              <Zap className="h-4 w-4" />
              {generateCode.isPending ? "Generating..." : "Generate My Referral Link"}
            </Button>
          )}

          {/* Share shortcuts */}
          {referralUrl && (
            <div className="flex gap-2 flex-wrap">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join me on GameTaverns — the community platform for board game libraries! 🎲 ${referralUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  𝕏 Share on X
                </Button>
              </a>
              <a
                href={`https://www.reddit.com/submit?url=${encodeURIComponent(referralUrl)}&title=${encodeURIComponent("Join GameTaverns — the best platform for board game libraries")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  🤖 Share on Reddit
                </Button>
              </a>
              <a
                href={`https://discord.com/channels/@me`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { e.preventDefault(); handleCopy(); }}
              >
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  💬 Share on Discord
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress to next tier */}
      {nextTier && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-primary" />
              Progress to {nextTier.label} {nextTier.emoji}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{confirmedCount} referral{confirmedCount !== 1 ? "s" : ""} confirmed</span>
              <span>{nextTier.threshold} needed</span>
            </div>
            <Progress value={progressToNext} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {nextTier.threshold - confirmedCount} more to earn <strong>{nextTier.label}</strong>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Badges earned */}
      {badges && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Badges</CardTitle>
          </CardHeader>
          <CardContent>
            <ReferralBadges badges={badges} size="md" showLabels className="mb-4" />

            {/* All tiers overview */}
            <div className="space-y-2">
              {REFERRAL_TIERS.map((tier) => {
                const earned = badges[tier.key];
                const Icon = TIER_ICONS[tier.key];
                return (
                  <div key={tier.key} className={cn(
                    "flex items-center gap-3 p-2 rounded-lg border",
                    earned ? "border-primary/20 bg-primary/5" : "border-border opacity-50"
                  )}>
                    <span className="text-xl">{tier.emoji}</span>
                    <div className="flex-1">
                      <p className={cn("text-sm font-medium", earned ? "text-foreground" : "text-muted-foreground")}>
                        {tier.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{tier.description}</p>
                    </div>
                    {earned && <Badge variant="secondary" className="text-xs">Earned ✓</Badge>}
                    {!earned && (
                      <span className="text-xs text-muted-foreground">{tier.threshold} referrals</span>
                    )}
                  </div>
                );
              })}

              {/* Founding Member */}
              <div className={cn(
                "flex items-center gap-3 p-2 rounded-lg border",
                badges.is_founding_member ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : "border-border opacity-40"
              )}>
                <span className="text-xl">{FOUNDING_MEMBER_BADGE.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{FOUNDING_MEMBER_BADGE.label}</p>
                    <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700">
                      Time-locked
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{FOUNDING_MEMBER_BADGE.description}</p>
                </div>
                {badges.is_founding_member && <Badge variant="secondary" className="text-xs">Earned ✓</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmed referrals list */}
      {referrals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Referral History ({confirmedCount} confirmed)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {referrals.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                  <span className="font-mono text-xs text-muted-foreground">{r.referral_code}</span>
                  {r.referred_user_id ? (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Signed up ✓</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
