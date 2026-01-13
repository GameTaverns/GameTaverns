import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, 
  Shield, 
  Upload, 
  Plus, 
  Trash2, 
  Edit, 
  ArrowLeft,
  Loader2,
  Settings as SettingsIcon,
  Mail,
  Lock,
  Users
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useGames, useDeleteGame } from "@/hooks/useGames";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, loading } = useAuth();
  const { data: games = [], isLoading: gamesLoading } = useGames();
  const deleteGame = useDeleteGame();
  const { toast } = useToast();

  const [bggUrl, setBggUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  
  // Profile form states
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Redirect if not authenticated
  if (!loading && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  const handleBGGImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bggUrl.trim()) return;

    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bgg-import", {
        body: { url: bggUrl },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Game imported!",
          description: `"${data.game.title}" has been added to your collection.`,
        });
        setBggUrl("");
      } else {
        throw new Error(data.error || "Import failed");
      }
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Could not import game from BoardGameGeek",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    try {
      await deleteGame.mutateAsync(id);
      toast({
        title: "Game deleted",
        description: `"${title}" has been removed from your collection.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not delete game",
        variant: "destructive",
      });
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsUpdatingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      toast({
        title: "Email update initiated",
        description: "Please check your new email address for a confirmation link.",
      });
      setNewEmail("");
    } catch (error: any) {
      toast({
        title: "Error updating email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Error updating password",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="font-display text-3xl font-bold">Settings</h1>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? "grid-cols-3" : "grid-cols-1"}`}>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="games" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Game Management
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  User Management
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Account Info */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Account Information
                  </CardTitle>
                  <CardDescription>
                    Your current account details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{user?.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium">{isAdmin ? "Admin" : "User"}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Member since</span>
                    <span className="font-medium">
                      {user?.created_at 
                        ? new Date(user.created_at).toLocaleDateString() 
                        : "N/A"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Update Email */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Update Email
                  </CardTitle>
                  <CardDescription>
                    Change your email address
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateEmail} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-email">New Email Address</Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="newemail@example.com"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isUpdatingEmail}>
                      {isUpdatingEmail ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Update Email"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Update Password */}
              <Card className="card-elevated md:col-span-2">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Change Password
                  </CardTitle>
                  <CardDescription>
                    Update your account password
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          minLength={6}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          minLength={6}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={isUpdatingPassword}>
                      {isUpdatingPassword ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Change Password"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Game Management Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="games" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Import Card */}
                <Card className="lg:col-span-1 card-elevated">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Import from BGG
                    </CardTitle>
                    <CardDescription>
                      Paste a BoardGameGeek game URL to import game data automatically
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleBGGImport} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="bgg-url">BoardGameGeek URL</Label>
                        <Input
                          id="bgg-url"
                          type="url"
                          value={bggUrl}
                          onChange={(e) => setBggUrl(e.target.value)}
                          placeholder="https://boardgamegeek.com/boardgame/..."
                          disabled={isImporting}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isImporting}>
                        {isImporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Import Game
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Add Game Card */}
                <Card className="lg:col-span-2 card-elevated">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Add New Game
                    </CardTitle>
                    <CardDescription>
                      Manually add a new game to your collection
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => navigate("/admin/add")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Game Manually
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Games Table */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="font-display">
                    Game Collection ({games.length})
                  </CardTitle>
                  <CardDescription>
                    Manage your game library
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {gamesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : games.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No games in your collection yet. Import or add one above!
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Difficulty</TableHead>
                          <TableHead>Players</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {games.map((game) => (
                          <TableRow key={game.id}>
                            <TableCell className="font-medium">{game.title}</TableCell>
                            <TableCell>{game.game_type}</TableCell>
                            <TableCell>{game.difficulty}</TableCell>
                            <TableCell>
                              {game.min_players}-{game.max_players}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/admin/edit/${game.id}`)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Game</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{game.title}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(game.id, game.title)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* User Management Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="users" className="space-y-6">
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Management
                  </CardTitle>
                  <CardDescription>
                    Manage user roles and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-center py-8">
                    User management features coming soon. You'll be able to view users, 
                    assign roles, and manage permissions here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;
