import { useState, useEffect } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/backend/client";

export function EmailPreferencesCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [optedOut, setOptedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("user_profiles")
      .select("marketing_emails_opted_out")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setOptedOut(data?.marketing_emails_opted_out ?? false);
        setLoading(false);
      });
  }, [user?.id]);

  const handleToggle = async (checked: boolean) => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({ marketing_emails_opted_out: checked })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update preference", variant: "destructive" });
    } else {
      setOptedOut(checked);
      toast({
        title: checked ? "Unsubscribed" : "Subscribed",
        description: checked
          ? "You won't receive marketing emails from GameTaverns."
          : "You'll receive occasional updates from GameTaverns.",
      });
    }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Preferences
        </CardTitle>
        <CardDescription>Control which emails you receive from GameTaverns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Marketing & re-engagement emails</Label>
            <p className="text-xs text-muted-foreground">
              Occasional updates about new features, events, and community highlights
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={!optedOut}
              onCheckedChange={(checked) => handleToggle(!checked)}
              disabled={saving}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
