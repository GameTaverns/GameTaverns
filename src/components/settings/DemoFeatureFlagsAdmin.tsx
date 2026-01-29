import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useDemoMode, DemoFeatureFlags } from "@/contexts/DemoContext";
import { 
  Settings2, 
  History, 
  Heart, 
  DollarSign, 
  MessageSquare, 
  Clock,
  RotateCcw,
  Star,
  Calendar,
  Trophy,
  BookOpen
} from "lucide-react";

const FEATURE_FLAG_LABELS: Record<keyof DemoFeatureFlags, string> = {
  playLogs: "Play Logs",
  wishlist: "Wishlist / Voting",
  forSale: "For Sale",
  messaging: "Messaging",
  comingSoon: "Coming Soon",
  ratings: "Ratings",
  events: "Events Calendar",
  achievements: "Achievements",
  lending: "Game Lending",
};

const FEATURE_FLAG_DESCRIPTIONS: Record<keyof DemoFeatureFlags, string> = {
  playLogs: "Track game sessions and play history",
  wishlist: "Allow guests to vote for games they want to play",
  forSale: "Show games that are for sale with pricing",
  messaging: "Allow visitors to send messages about games",
  comingSoon: "Show upcoming games that aren't available yet",
  ratings: "Allow visitors to rate games (5-star system)",
  events: "Show upcoming events and calendar to visitors",
  achievements: "Show achievements and badges for library engagement",
  lending: "Allow registered users to request game loans",
};

const FEATURE_FLAG_ICONS: Record<keyof DemoFeatureFlags, React.ComponentType<{ className?: string }>> = {
  playLogs: History,
  wishlist: Heart,
  forSale: DollarSign,
  messaging: MessageSquare,
  comingSoon: Clock,
  ratings: Star,
  events: Calendar,
  achievements: Trophy,
  lending: BookOpen,
};

export function DemoFeatureFlagsAdmin() {
  const { demoFeatureFlags, setDemoFeatureFlags } = useDemoMode();

  const handleToggle = (flagKey: keyof DemoFeatureFlags) => {
    setDemoFeatureFlags({ [flagKey]: !demoFeatureFlags[flagKey] });
  };

  const handleResetAll = () => {
    setDemoFeatureFlags({
      playLogs: true,
      wishlist: true,
      forSale: true,
      messaging: true,
      comingSoon: true,
      ratings: true,
      events: true,
      achievements: true,
      lending: true,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <CardTitle>Demo Feature Flags</CardTitle>
          </div>
        </div>
        <CardDescription>
          Toggle features on and off to see how the platform behaves with different configurations.
          Changes are applied instantly in demo mode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {(Object.keys(demoFeatureFlags) as Array<keyof DemoFeatureFlags>).map((flagKey) => {
          const Icon = FEATURE_FLAG_ICONS[flagKey];
          
          return (
            <div
              key={flagKey}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor={`demo-${flagKey}`} className="text-base font-medium">
                    {FEATURE_FLAG_LABELS[flagKey]}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {FEATURE_FLAG_DESCRIPTIONS[flagKey]}
                  </p>
                </div>
              </div>
              <Switch
                id={`demo-${flagKey}`}
                checked={demoFeatureFlags[flagKey]}
                onCheckedChange={() => handleToggle(flagKey)}
              />
            </div>
          );
        })}

        <div className="flex items-center justify-end pt-4 border-t">
          <Button variant="outline" onClick={handleResetAll}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset All to Enabled
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
