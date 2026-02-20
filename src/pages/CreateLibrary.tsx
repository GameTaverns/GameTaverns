import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gamepad2, Check, X, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useSlugAvailability, useCreateLibrary, useUpdateLibrarySettings, useMyLibraries, useMaxLibrariesPerUser } from "@/hooks/useLibrary";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";

export default function CreateLibrary() {
  const { isAuthenticated } = useAuth();
  const { data: myLibraries = [], isLoading: librariesLoading } = useMyLibraries();
  const { data: maxLibraries = 1 } = useMaxLibrariesPerUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createLibrary = useCreateLibrary();
  const updateSettings = useUpdateLibrarySettings();
  
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [manualSlug, setManualSlug] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  
  const debouncedSlug = useDebounce(slug, 300);
  const { data: slugCheck, isLoading: checkingSlug } = useSlugAvailability(debouncedSlug);

  const atLimit = myLibraries.length >= maxLibraries;
  
  // Redirect if already at library limit
  useEffect(() => {
    if (!librariesLoading && atLimit) {
      navigate("/dashboard");
    }
  }, [atLimit, librariesLoading, navigate]);
  
  // Auto-generate slug from name
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
    
    if (!slugCheck?.available) {
      toast({
        title: "Invalid library name",
        description: slugCheck?.reason || "Please choose a different name",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const library = await createLibrary.mutateAsync({ slug, name, description });
      // Update discoverability if set to private
      if (!isDiscoverable) {
        await updateSettings.mutateAsync({
          libraryId: library.id,
          updates: { is_discoverable: false },
        });
      }
      toast({
        title: "Library created!",
        description: `Your library is now live at ${slug}.gametaverns.com`,
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Failed to create library",
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
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-sidebar/80 border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <Link to="/" className="flex items-center justify-center gap-3 mb-4">
            <div className="p-2 bg-secondary/20 rounded-lg">
              <Gamepad2 className="h-8 w-8 text-secondary" />
            </div>
            <span className="font-display text-2xl font-bold text-cream">GameTaverns</span>
          </Link>
          <CardTitle className="font-display text-2xl text-cream">Create Your Library</CardTitle>
          <CardDescription className="text-muted-foreground">
            Set up your personal board game collection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Library Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-cream/80">
                Library Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Board Game Collection"
                className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                required
              />
            </div>
            
            {/* Slug / URL */}
            <div className="space-y-2">
              <Label htmlFor="slug" className="text-cream/80">
                Library URL
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="my-collection"
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
                <span className="text-muted-foreground text-sm whitespace-nowrap">
                  .gametaverns.com
                </span>
              </div>
              {slug.length >= 3 && !checkingSlug && slugCheck && !slugCheck.available && (
                <p className="text-red-400 text-sm">{slugCheck.reason}</p>
              )}
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-cream/80">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A collection of my favorite board games..."
                className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground resize-none"
                rows={3}
              />
            </div>

            {/* Privacy Toggle */}
            <div className="flex items-center justify-between p-3 bg-wood-medium/30 rounded-lg border border-border/30">
              <div className="flex items-center gap-2">
                {isDiscoverable ? (
                  <Eye className="h-4 w-4 text-secondary" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="discoverable" className="text-cream/80 text-sm font-medium cursor-pointer">
                    {isDiscoverable ? "Public Library" : "Private Library"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isDiscoverable
                      ? "Visible in the library directory"
                      : "Hidden from the library directory"}
                  </p>
                </div>
              </div>
              <Switch
                id="discoverable"
                checked={isDiscoverable}
                onCheckedChange={setIsDiscoverable}
              />
            </div>
            
            {/* Preview */}
            <div className="p-4 bg-wood-medium/30 rounded-lg border border-border/30">
              <div className="text-sm text-muted-foreground mb-1">Your library will be at:</div>
              <div className="font-mono text-secondary">
                https://{slug || "your-library"}.gametaverns.com
              </div>
            </div>
            
            {/* Submit */}
            <Button
              type="submit"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display"
              disabled={createLibrary.isPending || !slugCheck?.available}
            >
              {createLibrary.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Library"
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
