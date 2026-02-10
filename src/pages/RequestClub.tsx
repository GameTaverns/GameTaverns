import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Check, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useRequestClub } from "@/hooks/useClubs";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/backend/client";
import { useQuery } from "@tanstack/react-query";

export default function RequestClub() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const requestClub = useRequestClub();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [manualSlug, setManualSlug] = useState(false);

  const debouncedSlug = useDebounce(slug, 300);

  // Check slug availability for clubs
  const { data: slugCheck, isLoading: checkingSlug } = useQuery({
    queryKey: ["club-slug-check", debouncedSlug],
    queryFn: async () => {
      if (!debouncedSlug || debouncedSlug.length < 3)
        return { available: false, reason: "Must be at least 3 characters" };
      const slugRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
      if (!slugRegex.test(debouncedSlug))
        return { available: false, reason: "Lowercase letters, numbers, and hyphens only" };

      const { data } = await supabase
        .from("clubs")
        .select("id")
        .eq("slug", debouncedSlug)
        .maybeSingle();
      return { available: !data, reason: data ? "Already taken" : null };
    },
    enabled: debouncedSlug.length >= 3,
  });

  useEffect(() => {
    if (!manualSlug && name) {
      const generated = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30);
      setSlug(generated);
    }
  }, [name, manualSlug]);

  const handleSlugChange = (value: string) => {
    setManualSlug(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slugCheck?.available) return;

    try {
      await requestClub.mutateAsync({ name, slug, description, is_public: isPublic });
      toast({
        title: "Club request submitted!",
        description: "A platform admin will review your request shortly.",
      });
      navigate("/dashboard?tab=clubs");
    } catch (error: any) {
      toast({
        title: "Failed to request club",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-sidebar/80 border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-2 bg-secondary/20 rounded-lg">
              <Users className="h-8 w-8 text-secondary" />
            </div>
          </div>
          <CardTitle className="font-display text-2xl text-cream">Request a Club</CardTitle>
          <CardDescription className="text-muted-foreground">
            Create a club to connect multiple board game libraries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-cream/80">Club Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Awesome Board Game Club"
                className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug" className="text-cream/80">Club URL</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="awesome-bgc"
                    className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground pr-10"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingSlug ? (
                      <Loader2 className="h-4 w-4 text-secondary animate-spin" />
                    ) : slugCheck?.available ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : slug.length >= 3 ? (
                      <X className="h-4 w-4 text-red-400" />
                    ) : null}
                  </div>
                </div>
              </div>
              {slug.length >= 3 && !checkingSlug && slugCheck && !slugCheck.available && (
                <p className="text-red-400 text-sm">{slugCheck.reason}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-cream/80">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Our local board game community..."
                className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground resize-none"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-wood-medium/30 rounded-lg border border-border/30">
              <div>
                <Label className="text-cream/80">Public Club</Label>
                <p className="text-xs text-muted-foreground">
                  Public clubs appear in the directory
                </p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            <div className="p-4 bg-wood-medium/30 rounded-lg border border-border/30">
              <p className="text-sm text-cream/70">
                ℹ️ Your request will be reviewed by a platform admin. Once approved,
                you'll be able to generate invite codes for other library owners to join.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display"
              disabled={requestClub.isPending || !slugCheck?.available}
            >
              {requestClub.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/dashboard" className="text-secondary hover:text-secondary/80 underline text-sm">
              Back to Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
