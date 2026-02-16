import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useRedeemInviteCode } from "@/hooks/useClubs";
import { useMyLibraries } from "@/hooks/useLibrary";
import { useToast } from "@/hooks/use-toast";

export default function JoinClub() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: myLibraries = [], isLoading: librariesLoading } = useMyLibraries();
  const redeemCode = useRedeemInviteCode();

  const [code, setCode] = useState("");
  const [selectedLibraryId, setSelectedLibraryId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLibraryId) {
      toast({ title: "Select a library", description: "Choose which library to add to the club", variant: "destructive" });
      return;
    }

    try {
      await redeemCode.mutateAsync({ code: code.trim(), library_id: selectedLibraryId });
      toast({
        title: "Joined club!",
        description: "Your library has been added to the club.",
      });
      navigate("/dashboard?tab=clubs");
    } catch (error: any) {
      toast({
        title: "Failed to join club",
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
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-2 bg-secondary/20 rounded-lg">
              <Ticket className="h-8 w-8 text-secondary" />
            </div>
          </div>
          <CardTitle className="font-display text-2xl text-cream">Join a Club</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter an invite code to add your library to a club
          </CardDescription>
        </CardHeader>
        <CardContent>
          {librariesLoading ? (
            <div className="text-center text-cream/60 py-4">Loading...</div>
          ) : myLibraries.length === 0 ? (
            <div className="text-center space-y-4">
              <p className="text-cream/70">
                You need a library before you can join a club.
              </p>
              <Link to="/create-library">
                <Button className="bg-secondary text-secondary-foreground">
                  Create a Library First
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-cream/80">Invite Code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABCD1234"
                  className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground font-mono text-center text-lg tracking-widest"
                  maxLength={12}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-cream/80">Select Library</Label>
                <Select value={selectedLibraryId} onValueChange={setSelectedLibraryId}>
                  <SelectTrigger className="bg-wood-medium/50 border-border/50 text-cream">
                    <SelectValue placeholder="Choose a library to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {myLibraries.map((lib) => (
                      <SelectItem key={lib.id} value={lib.id}>
                        {lib.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display"
                disabled={redeemCode.isPending || !code.trim() || !selectedLibraryId}
              >
                {redeemCode.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join Club"
                )}
              </Button>
            </form>
          )}

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
