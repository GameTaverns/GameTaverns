import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gamepad2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useSlugAvailability, useCreateLibrary, useMyLibrary } from "@/hooks/useLibrary";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";

export default function CreateLibrary() {
  const { isAuthenticated } = useAuth();
  const { data: existingLibrary } = useMyLibrary();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createLibrary = useCreateLibrary();
  
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [manualSlug, setManualSlug] = useState(false);
  
  const debouncedSlug = useDebounce(slug, 300);
  const { data: slugCheck, isLoading: checkingSlug } = useSlugAvailability(debouncedSlug);
  
  // Redirect if already has a library
  useEffect(() => {
    if (existingLibrary) {
      navigate("/dashboard");
    }
  }, [existingLibrary, navigate]);
  
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
      await createLibrary.mutateAsync({ slug, name, description });
      toast({
        title: "Library created!",
        description: `Your library is now live at ${slug}.gametaverns.com`,
      });
      // Redirect to dashboard where they can access their library
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
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900">
      {/* Header */}
      <header className="border-b border-amber-700/50 bg-amber-950/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Gamepad2 className="h-8 w-8 text-amber-400" />
            <span className="font-display text-2xl font-bold text-amber-100">
              GameTaverns
            </span>
          </Link>
          
          <Link to="/dashboard">
            <Button variant="ghost" className="text-amber-200 hover:text-amber-100 hover:bg-amber-800/50">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-12 max-w-xl">
        <Card className="bg-amber-800/30 border-amber-700/50">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-3xl text-amber-100">
              Create Your Library
            </CardTitle>
            <CardDescription className="text-amber-200/70">
              Set up your personal board game collection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Library Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-amber-200">
                  Library Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Board Game Collection"
                  className="bg-amber-900/50 border-amber-700/50 text-amber-100 placeholder:text-amber-200/40"
                  required
                />
              </div>
              
              {/* Slug / URL */}
              <div className="space-y-2">
                <Label htmlFor="slug" className="text-amber-200">
                  Library URL
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="my-collection"
                      className="bg-amber-900/50 border-amber-700/50 text-amber-100 placeholder:text-amber-200/40 pr-10"
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingSlug ? (
                        <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                      ) : slugCheck?.available ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : slug.length >= 3 ? (
                        <X className="h-4 w-4 text-red-400" />
                      ) : null}
                    </div>
                  </div>
                  <span className="text-amber-200/60 text-sm whitespace-nowrap">
                    .gametaverns.com
                  </span>
                </div>
                {slug.length >= 3 && !checkingSlug && slugCheck && !slugCheck.available && (
                  <p className="text-red-400 text-sm">{slugCheck.reason}</p>
                )}
              </div>
              
              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-amber-200">
                  Description <span className="text-amber-200/40">(optional)</span>
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A collection of my favorite board games..."
                  className="bg-amber-900/50 border-amber-700/50 text-amber-100 placeholder:text-amber-200/40 resize-none"
                  rows={3}
                />
              </div>
              
              {/* Preview */}
              <div className="p-4 bg-amber-900/30 rounded-lg border border-amber-700/30">
                <div className="text-sm text-amber-200/60 mb-1">Your library will be at:</div>
                <div className="font-mono text-amber-400">
                  https://{slug || "your-library"}.gametaverns.com
                </div>
              </div>
              
              {/* Submit */}
              <Button
                type="submit"
                className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400"
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
