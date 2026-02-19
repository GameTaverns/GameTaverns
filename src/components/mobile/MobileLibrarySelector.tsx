import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Library, ArrowRight, Loader2, LogIn } from "lucide-react";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { toast } from "sonner";
import { useMobileLibrary } from "@/hooks/useCapacitor";
import { getLibraryUrl } from "@/hooks/useTenantUrl";

interface MobileLibrarySelectorProps {
  onLibrarySelected?: (slug: string) => void;
}

export function MobileLibrarySelector({ onLibrarySelected }: MobileLibrarySelectorProps) {
  const [librarySlug, setLibrarySlug] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { selectLibrary } = useMobileLibrary();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const slug = librarySlug.toLowerCase().trim();
    if (!slug) {
      toast.error("Please enter a library name");
      return;
    }

    setIsLoading(true);
    try {
      // Verify library exists
      const { data, error } = await supabase
        .from('libraries_public')
        .select('slug, name, is_active')
        .eq('slug', slug)
        .single();

      if (error || !data) {
        toast.error("Library not found", {
          description: "Please check the library name and try again.",
        });
        return;
      }

      if (!data.is_active) {
        toast.error("Library is not available", {
          description: "This library is currently suspended.",
        });
        return;
      }

      // Store the library selection
      await selectLibrary(slug);
      
      toast.success(`Connected to ${data.name}`);
      
      // Notify parent or navigate
      if (onLibrarySelected) {
        onLibrarySelected(slug);
      } else {
        // Navigate to tenant subdomain
        window.location.href = getLibraryUrl(slug, "/");
      }
    } catch (err) {
      console.error('Error checking library:', err);
      toast.error("Failed to connect to library");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Library className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">Join a Library</CardTitle>
          <CardDescription>
            Enter the name of the game library you want to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="librarySlug">Library Name</Label>
              <div className="flex gap-2">
                <Input
                  id="librarySlug"
                  placeholder="e.g., boardgame-cafe"
                  value={librarySlug}
                  onChange={(e) => setLibrarySlug(e.target.value)}
                  className="flex-1"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The library name is usually in the URL: <span className="font-mono">library-name</span>.gametaverns.com
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !librarySlug.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-sm text-muted-foreground mb-2">Already have an account?</p>
            <Link to="/login">
              <Button variant="outline" className="w-full">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
