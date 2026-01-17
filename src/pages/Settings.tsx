import { useState, useEffect, useMemo } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  Users,
  Tag,
  Building,
  Globe,
  Palette,
  ChevronLeft,
  ChevronRight,
  MapPin,
  DollarSign
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useGames, useDeleteGame, useMechanics, usePublishers, useCreateMechanic, useCreatePublisher } from "@/hooks/useGames";
import { useUnreadMessageCount } from "@/hooks/useMessages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeCustomizer } from "@/components/settings/ThemeCustomizer";
import { SALE_CONDITION_OPTIONS, type SaleCondition, type GameWithRelations } from "@/types/game";

type UserWithRole = {
  id: string;
  email: string;
  created_at: string;
  role: string | null;
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface GameCollectionTableProps {
  games: GameWithRelations[];
  filterLetter: string | null;
  setFilterLetter: (letter: string | null) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  gamesPerPage: number;
  onEdit: (id: string) => void;
  onDelete: (id: string, title: string) => void;
}

function GameCollectionTable({
  games,
  filterLetter,
  setFilterLetter,
  currentPage,
  setCurrentPage,
  gamesPerPage,
  onEdit,
  onDelete,
}: GameCollectionTableProps) {
  // Filter by letter
  const filteredGames = useMemo(() => {
    let result = [...games].sort((a, b) => a.title.localeCompare(b.title));
    if (filterLetter) {
      result = result.filter(g => g.title.toUpperCase().startsWith(filterLetter));
    }
    return result;
  }, [games, filterLetter]);

  // Pagination
  const totalPages = Math.ceil(filteredGames.length / gamesPerPage);
  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * gamesPerPage;
    return filteredGames.slice(start, start + gamesPerPage);
  }, [filteredGames, currentPage, gamesPerPage]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterLetter, setCurrentPage]);

  // Get letters that have games
  const lettersWithGames = useMemo(() => {
    const letters = new Set<string>();
    games.forEach(g => {
      const firstLetter = g.title.charAt(0).toUpperCase();
      if (ALPHABET.includes(firstLetter)) {
        letters.add(firstLetter);
      }
    });
    return letters;
  }, [games]);

  return (
    <div className="space-y-4">
      {/* A-Z Filter Bar */}
      <div className="flex flex-wrap gap-1 p-2 bg-muted/50 rounded-lg">
        <Button
          variant={filterLetter === null ? "default" : "ghost"}
          size="sm"
          className="h-8 px-2 text-xs font-medium"
          onClick={() => setFilterLetter(null)}
        >
          All
        </Button>
        {ALPHABET.map(letter => {
          const hasGames = lettersWithGames.has(letter);
          return (
            <Button
              key={letter}
              variant={filterLetter === letter ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0 text-xs font-medium"
              onClick={() => setFilterLetter(letter)}
              disabled={!hasGames}
            >
              {letter}
            </Button>
          );
        })}
      </div>

      {/* Results info */}
      <div className="text-sm text-muted-foreground">
        Showing {paginatedGames.length} of {filteredGames.length} games
        {filterLetter && ` starting with "${filterLetter}"`}
      </div>

      {/* Table */}
      {paginatedGames.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No games found{filterLetter ? ` starting with "${filterLetter}"` : ''}.
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
            {paginatedGames.map((game) => (
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
                      onClick={() => onEdit(game.id)}
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
                            onClick={() => onDelete(game.id, game.title)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

const Settings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const deleteGame = useDeleteGame();
  
  // Only fetch games when admin (lazy load for performance)
  const { data: games = [], isLoading: gamesLoading } = useGames(isAdmin);
  const { data: mechanics = [], isLoading: mechanicsLoading, refetch: refetchMechanics } = useMechanics();
  const { data: publishers = [], isLoading: publishersLoading, refetch: refetchPublishers } = usePublishers();
  const createMechanic = useCreateMechanic();
  const createPublisher = useCreatePublisher();
  const { data: unreadCount = 0 } = useUnreadMessageCount();

  // Game collection filter/pagination states
  const [gameFilterLetter, setGameFilterLetter] = useState<string | null>(null);
  const [gameCurrentPage, setGameCurrentPage] = useState(1);
  const GAMES_PER_PAGE = 20;

  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importAsComingSoon, setImportAsComingSoon] = useState(false);
  const [importAsForSale, setImportAsForSale] = useState(false);
  const [importAsExpansion, setImportAsExpansion] = useState(false);
  const [importParentGameId, setImportParentGameId] = useState<string | null>(null);
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [importSalePrice, setImportSalePrice] = useState("");
  const [importSaleCondition, setImportSaleCondition] = useState<SaleCondition | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [importLocationRoom, setImportLocationRoom] = useState("");
  const [importLocationShelf, setImportLocationShelf] = useState("");
  const [lastImportedGameTitle, setLastImportedGameTitle] = useState("");
  const [importPurchasePrice, setImportPurchasePrice] = useState("");
  const [importPurchaseDate, setImportPurchaseDate] = useState("");
  
  // Profile form states
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Category management states
  const [newMechanicName, setNewMechanicName] = useState("");
  const [newPublisherName, setNewPublisherName] = useState("");
  const [isCreatingMechanic, setIsCreatingMechanic] = useState(false);
  const [isCreatingPublisher, setIsCreatingPublisher] = useState(false);

  // User management states
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);

  // Site settings states
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({});
  const [isLoadingSiteSettings, setIsLoadingSiteSettings] = useState(false);
  const [isSavingSiteSettings, setIsSavingSiteSettings] = useState(false);

  // Fetch users and site settings when admin
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchSiteSettings();
    }
  }, [isAdmin]);

  const fetchSiteSettings = async () => {
    setIsLoadingSiteSettings(true);
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value");
      
      if (error) throw error;
      
      const settingsMap: Record<string, string> = {};
      data?.forEach((setting) => {
        settingsMap[setting.key] = setting.value || "";
      });
      setSiteSettings(settingsMap);
    } catch (error) {
      console.error("Error fetching site settings:", error);
      toast({
        title: "Error",
        description: "Could not fetch site settings",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSiteSettings(false);
    }
  };

  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSiteSettings(true);
    try {
      // Upsert each setting (update if exists, insert if not)
      for (const [key, value] of Object.entries(siteSettings)) {
        const { error } = await supabase
          .from("site_settings")
          .upsert({ key, value }, { onConflict: 'key' });
        
        if (error) throw error;
      }

      // Invalidate the site settings cache so changes reflect immediately
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });

      toast({
        title: "Settings saved",
        description: "Site settings have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not save site settings",
        variant: "destructive",
      });
    } finally {
      setIsSavingSiteSettings(false);
    }
  };

  const updateSiteSetting = (key: string, value: string) => {
    setSiteSettings(prev => ({ ...prev, [key]: value }));
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Get current user info
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Build users list from roles
      const userMap = new Map<string, UserWithRole>();
      
      // Add current user
      if (currentUser) {
        userMap.set(currentUser.id, {
          id: currentUser.id,
          email: currentUser.email || "Unknown",
          created_at: currentUser.created_at || new Date().toISOString(),
          role: null,
        });
      }

      // Apply roles
      roles?.forEach((r) => {
        const existing = userMap.get(r.user_id);
        if (existing) {
          existing.role = r.role;
        } else {
          userMap.set(r.user_id, {
            id: r.user_id,
            email: "Unknown",
            created_at: new Date().toISOString(),
            role: r.role,
          });
        }
      });

      setUsers(Array.from(userMap.values()));
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Could not fetch users",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Redirect if not authenticated
  if (!loading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = importUrl.trim();
    if (!trimmed) return;

    // Prefer the dedicated BGG importer for BGG boardgame pages, but fall back to the
    // general-purpose importer if BGG blocks the XML API.
    const isBggBoardgame = /https?:\/\/(www\.)?boardgamegeek\.com\/boardgame\/\d+/i.test(trimmed);

    setIsImporting(true);
    try {
      const invoke = async (fn: string) =>
        supabase.functions.invoke(fn, {
          body: { 
            url: trimmed, 
            is_coming_soon: importAsComingSoon, 
            is_for_sale: importAsForSale,
            sale_price: importAsForSale && importSalePrice ? parseFloat(importSalePrice) : null,
            sale_condition: importAsForSale ? importSaleCondition : null,
            is_expansion: importAsExpansion,
            parent_game_id: importAsExpansion ? importParentGameId : null,
            location_room: importLocationRoom.trim() || null,
            location_shelf: importLocationShelf.trim() || null,
            purchase_price: importPurchasePrice ? parseFloat(importPurchasePrice) : null,
            purchase_date: importPurchaseDate || null,
          },
        });

      let data: any;

      if (isBggBoardgame) {
        const first = await invoke("bgg-import");
        if (first.error || !first.data?.success) {
          const fallback = await invoke("game-import");
          if (fallback.error) throw fallback.error;
          data = fallback.data;
        } else {
          data = first.data;
        }
      } else {
        const res = await invoke("game-import");
        if (res.error) throw res.error;
        data = res.data;
      }

      if (data?.success) {
        // Invalidate the games cache so the collection updates immediately
        queryClient.invalidateQueries({ queryKey: ["games"] });

        const statusLabel = importAsExpansion 
          ? `as an expansion${importParentGameId ? '' : ' (no parent set)'}`
          : importAsComingSoon 
            ? 'to "Coming Soon" list' 
            : importAsForSale 
              ? 'to "For Sale" section' 
              : 'to collection';
        toast({
          title: "Game imported!",
          description: `"${data.game.title}" has been added ${statusLabel}.`,
        });
        
        // Show location dialog for non-Coming Soon imports if location wasn't already set
        if (!importAsComingSoon && !importLocationRoom && !importLocationShelf) {
          setLastImportedGameTitle(data.game.title);
          setShowLocationDialog(true);
        }
        
        setImportUrl("");
        setImportAsComingSoon(false);
        setImportAsForSale(false);
        setImportSalePrice("");
        setImportSaleCondition(null);
        setImportAsExpansion(false);
        setImportParentGameId(null);
        setImportLocationRoom("");
        setImportLocationShelf("");
        setImportPurchasePrice("");
        setImportPurchaseDate("");
      } else {
        throw new Error(data?.error || "Import failed");
      }
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Could not import game from URL",
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

  const handleCreateMechanic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMechanicName.trim()) return;

    setIsCreatingMechanic(true);
    try {
      await createMechanic.mutateAsync(newMechanicName.trim());
      toast({
        title: "Mechanic created",
        description: `"${newMechanicName}" has been added.`,
      });
      setNewMechanicName("");
      refetchMechanics();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not create mechanic",
        variant: "destructive",
      });
    } finally {
      setIsCreatingMechanic(false);
    }
  };

  const handleCreatePublisher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPublisherName.trim()) return;

    setIsCreatingPublisher(true);
    try {
      await createPublisher.mutateAsync(newPublisherName.trim());
      toast({
        title: "Publisher created",
        description: `"${newPublisherName}" has been added.`,
      });
      setNewPublisherName("");
      refetchPublishers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not create publisher",
        variant: "destructive",
      });
    } finally {
      setIsCreatingPublisher(false);
    }
  };

  const handleDeleteMechanic = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("mechanics").delete().eq("id", id);
      if (error) throw error;
      toast({
        title: "Mechanic deleted",
        description: `"${name}" has been removed.`,
      });
      refetchMechanics();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not delete mechanic",
        variant: "destructive",
      });
    }
  };

  const handleDeletePublisher = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("publishers").delete().eq("id", id);
      if (error) throw error;
      toast({
        title: "Publisher deleted",
        description: `"${name}" has been removed.`,
      });
      refetchPublishers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not delete publisher",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string | null) => {
    setUpdatingRoleUserId(userId);
    try {
      if (newRole === "none" || newRole === null) {
        // Remove role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        // Validate role is valid enum value
        const validRole = newRole as "admin" | "moderator" | "user";
        
        // Check if user already has a role
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingRole) {
          // Update existing role
          const { error } = await supabase
            .from("user_roles")
            .update({ role: validRole })
            .eq("user_id", userId);
          if (error) throw error;
        } else {
          // Insert new role
          const { error } = await supabase
            .from("user_roles")
            .insert([{ user_id: userId, role: validRole }]);
          if (error) throw error;
        }
      }

      toast({
        title: "Role updated",
        description: "User role has been updated successfully.",
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not update user role",
        variant: "destructive",
      });
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" type="button" onClick={() => navigate("/")}> 
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl font-bold">Settings</h1>
          </div>
          {isAdmin && (
            <Button asChild variant="outline" className="flex items-center gap-2 relative">
              <Link to="/admin/messages">
                <Mail className="h-4 w-4" />
                Messages
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </Link>
            </Button>
          )}
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? "grid-cols-5" : "grid-cols-1"}`}>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="games" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Games
                </TabsTrigger>
                <TabsTrigger value="categories" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Categories
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="site" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Site
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
                      Import from Web
                    </CardTitle>
                    <CardDescription>
                      Paste any board game URL to import game data automatically (BoardGameGeek, publisher sites, etc.)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleImport} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="import-url">Game Page URL</Label>
                        <Input
                          id="import-url"
                          type="url"
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          placeholder="https://boardgamegeek.com/boardgame/..."
                          disabled={isImporting}
                        />
                      </div>
                      <div className="flex items-center space-x-3 p-3 rounded-lg border border-border bg-muted/50">
                        <Checkbox
                          id="import-coming-soon"
                          checked={importAsComingSoon}
                          onCheckedChange={(checked) => setImportAsComingSoon(checked === true)}
                          disabled={isImporting}
                        />
                        <div className="space-y-0.5">
                          <label htmlFor="import-coming-soon" className="text-sm font-medium cursor-pointer">
                            Coming Soon
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Mark as purchased/backed but not yet received
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                          <Checkbox
                            id="import-for-sale"
                            checked={importAsForSale}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setShowSaleDialog(true);
                              } else {
                                setImportAsForSale(false);
                                setImportSalePrice("");
                                setImportSaleCondition(null);
                              }
                            }}
                            disabled={isImporting}
                          />
                          <div className="space-y-0.5">
                            <label htmlFor="import-for-sale" className="text-sm font-medium cursor-pointer">
                              For Sale
                            </label>
                            <p className="text-xs text-muted-foreground">
                              Mark as available for sale in the marketplace
                            </p>
                          </div>
                        </div>
                        {importAsForSale && (
                          <div className="pl-6 space-y-1 text-sm text-muted-foreground">
                            <p><span className="font-medium text-foreground">Price:</span> ${importSalePrice || "0"}</p>
                            <p><span className="font-medium text-foreground">Condition:</span> {importSaleCondition || "Not set"}</p>
                            <Button 
                              type="button" 
                              variant="link" 
                              size="sm" 
                              className="px-0 h-auto"
                              onClick={() => setShowSaleDialog(true)}
                            >
                              Edit sale details
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-primary/30 bg-primary/10">
                          <Checkbox
                            id="import-expansion"
                            checked={importAsExpansion}
                            onCheckedChange={(checked) => {
                              setImportAsExpansion(checked === true);
                              if (!checked) setImportParentGameId(null);
                            }}
                            disabled={isImporting}
                          />
                          <div className="space-y-0.5">
                            <label htmlFor="import-expansion" className="text-sm font-medium cursor-pointer">
                              This is an Expansion
                            </label>
                            <p className="text-xs text-muted-foreground">
                              Import as an expansion of an existing game
                            </p>
                          </div>
                        </div>
                        {importAsExpansion && (
                          <div className="pl-6 space-y-2">
                            <Label>Parent Game</Label>
                            <Select 
                              value={importParentGameId || ""} 
                              onValueChange={setImportParentGameId}
                              disabled={isImporting}
                            >
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Select base game..." />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                {games
                                  ?.filter((g) => !g.is_expansion)
                                  .sort((a, b) => a.title.localeCompare(b.title))
                                  .map((g) => (
                                    <SelectItem key={g.id} value={g.id}>
                                      {g.title}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      {/* Storage Location - Only show when NOT importing as Coming Soon */}
                      {!importAsComingSoon && (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3 p-3 rounded-lg border border-muted-foreground/30 bg-muted/30">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div className="space-y-0.5 flex-1">
                              <label className="text-sm font-medium">
                                Storage Location (Optional)
                              </label>
                              <p className="text-xs text-muted-foreground">
                                Pre-fill where this game will be stored
                              </p>
                            </div>
                          </div>
                          <div className="pl-6 grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor="import-location-room" className="text-xs">Room</Label>
                              <Input
                                id="import-location-room"
                                value={importLocationRoom}
                                onChange={(e) => setImportLocationRoom(e.target.value)}
                                placeholder="e.g., Living Room"
                                disabled={isImporting}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="import-location-shelf" className="text-xs">Shelf</Label>
                              <Input
                                id="import-location-shelf"
                                value={importLocationShelf}
                                onChange={(e) => setImportLocationShelf(e.target.value)}
                                placeholder="e.g., Top Shelf"
                                disabled={isImporting}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Purchase Information (Admin Only) */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                          <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <div className="space-y-0.5 flex-1">
                            <label className="text-sm font-medium text-amber-700 dark:text-amber-300">
                              Purchase Info (Admin Only)
                            </label>
                            <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                              Track your purchase - not publicly visible
                            </p>
                          </div>
                        </div>
                        <div className="pl-6 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="import-purchase-price" className="text-xs">Purchase Price ($)</Label>
                            <Input
                              id="import-purchase-price"
                              type="number"
                              min="0"
                              step="0.01"
                              value={importPurchasePrice}
                              onChange={(e) => setImportPurchasePrice(e.target.value)}
                              placeholder="0.00"
                              disabled={isImporting}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="import-purchase-date" className="text-xs">Purchase Date</Label>
                            <Input
                              id="import-purchase-date"
                              type="date"
                              value={importPurchaseDate}
                              onChange={(e) => setImportPurchaseDate(e.target.value)}
                              disabled={isImporting}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={isImporting || (importAsExpansion && !importParentGameId)}>
                        {isImporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {importAsExpansion ? "Import Expansion" : "Import Game"}
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
                <CardContent className="space-y-4">
                  {gamesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : games.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No games in your collection yet. Import or add one above!
                    </p>
                  ) : (
                    <GameCollectionTable
                      games={games}
                      filterLetter={gameFilterLetter}
                      setFilterLetter={setGameFilterLetter}
                      currentPage={gameCurrentPage}
                      setCurrentPage={setGameCurrentPage}
                      gamesPerPage={GAMES_PER_PAGE}
                      onEdit={(id) => navigate(`/admin/edit/${id}`)}
                      onDelete={handleDelete}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Categories Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="categories" className="space-y-6">
              {/* Fixed Filter Groups Info */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="font-display">Main Filter Categories</CardTitle>
                  <CardDescription>
                    These are the primary categories games are sorted/filtered by in the sidebar. These options are fixed.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-3">
                    <div>
                      <h4 className="font-medium mb-2">Difficulty</h4>
                      <div className="flex flex-wrap gap-1">
                        {["1 - Light", "2 - Medium Light", "3 - Medium", "4 - Medium Heavy", "5 - Heavy"].map((d) => (
                          <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Type</h4>
                      <div className="flex flex-wrap gap-1">
                        {["Board Game", "Card Game", "Dice Game", "Party Game", "War Game", "Miniatures", "RPG", "Other"].map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Play Time</h4>
                      <div className="flex flex-wrap gap-1">
                        {["0-15 Minutes", "15-30 Minutes", "30-45 Minutes", "45-60 Minutes", "60+ Minutes", "2+ Hours", "3+ Hours"].map((p) => (
                          <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Editable Categories */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Mechanics Card */}
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Game Mechanics
                    </CardTitle>
                    <CardDescription>
                      Manage game mechanics like Worker Placement, Set Collection, etc.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleCreateMechanic} className="flex gap-2">
                      <Input
                        value={newMechanicName}
                        onChange={(e) => setNewMechanicName(e.target.value)}
                        placeholder="New mechanic name"
                        disabled={isCreatingMechanic}
                      />
                      <Button type="submit" disabled={isCreatingMechanic}>
                        {isCreatingMechanic ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </form>

                    {mechanicsLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : mechanics.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        No mechanics yet. Add one above!
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {mechanics.map((mechanic) => (
                          <Badge 
                            key={mechanic.id} 
                            variant="secondary"
                            className="flex items-center gap-1 pr-1"
                          >
                            {mechanic.name}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Mechanic</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{mechanic.name}"? Games using this mechanic will lose the association.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteMechanic(mechanic.id, mechanic.name)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Publishers Card */}
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Publishers
                    </CardTitle>
                    <CardDescription>
                      Manage game publishers
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleCreatePublisher} className="flex gap-2">
                      <Input
                        value={newPublisherName}
                        onChange={(e) => setNewPublisherName(e.target.value)}
                        placeholder="New publisher name"
                        disabled={isCreatingPublisher}
                      />
                      <Button type="submit" disabled={isCreatingPublisher}>
                        {isCreatingPublisher ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </form>

                    {publishersLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : publishers.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        No publishers yet. Add one above!
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {publishers.map((publisher) => (
                          <Badge 
                            key={publisher.id} 
                            variant="secondary"
                            className="flex items-center gap-1 pr-1"
                          >
                            {publisher.name}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Publisher</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{publisher.name}"? Games using this publisher will lose the association.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeletePublisher(publisher.id, publisher.name)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
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
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : users.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No users found.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Member Since</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.email}</TableCell>
                            <TableCell>
                              <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                                {u.role || "user"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(u.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {u.id !== user?.id ? (
                                <Select
                                  value={u.role || "none"}
                                  onValueChange={(value) => handleUpdateUserRole(u.id, value)}
                                  disabled={updatingRoleUserId === u.id}
                                >
                                  <SelectTrigger className="w-32">
                                    {updatingRoleUserId === u.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <SelectValue />
                                    )}
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">User</SelectItem>
                                    <SelectItem value="moderator">Moderator</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-muted-foreground text-sm">You</span>
                              )}
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

          {/* Site Settings Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="site" className="space-y-6">
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Site Settings
                  </CardTitle>
                  <CardDescription>
                    Manage your site's name, description, and other metadata
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSiteSettings ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <form onSubmit={handleSaveSiteSettings} className="space-y-6">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="site_name">Site Name</Label>
                          <Input
                            id="site_name"
                            value={siteSettings.site_name || ""}
                            onChange={(e) => updateSiteSetting("site_name", e.target.value)}
                            placeholder="My Game Library"
                          />
                          <p className="text-xs text-muted-foreground">
                            The main title of your site, shown in browser tabs and search results
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="site_author">Site Author</Label>
                          <Input
                            id="site_author"
                            value={siteSettings.site_author || ""}
                            onChange={(e) => updateSiteSetting("site_author", e.target.value)}
                            placeholder="Your Name or Organization"
                          />
                          <p className="text-xs text-muted-foreground">
                            Author/organization name for meta tags
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="site_description">Site Description</Label>
                        <Input
                          id="site_description"
                          value={siteSettings.site_description || ""}
                          onChange={(e) => updateSiteSetting("site_description", e.target.value)}
                          placeholder="Browse and discover our collection of board games..."
                        />
                        <p className="text-xs text-muted-foreground">
                          A brief description shown in search results and social media previews (recommended: under 160 characters)
                        </p>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="contact_email">Contact Email</Label>
                          <Input
                            id="contact_email"
                            type="email"
                            value={siteSettings.contact_email || ""}
                            onChange={(e) => updateSiteSetting("contact_email", e.target.value)}
                            placeholder="contact@example.com"
                          />
                          <p className="text-xs text-muted-foreground">
                            Public contact email for inquiries
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="footer_text">Footer Text</Label>
                          <Input
                            id="footer_text"
                            value={siteSettings.footer_text || ""}
                            onChange={(e) => updateSiteSetting("footer_text", e.target.value)}
                            placeholder="© 2024 Your Organization. All rights reserved."
                          />
                          <p className="text-xs text-muted-foreground">
                            Custom text to display in the site footer
                          </p>
                        </div>
                      </div>

                      {/* Socials Section */}
                      <div className="border-t border-border pt-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Socials
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Add your social media links. These will appear as icons in the site header.
                        </p>
                        
                        <div className="grid gap-6 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="twitter_handle">Twitter/X Handle</Label>
                            <Input
                              id="twitter_handle"
                              value={siteSettings.twitter_handle || ""}
                              onChange={(e) => updateSiteSetting("twitter_handle", e.target.value)}
                              placeholder="@YourHandle"
                            />
                            <p className="text-xs text-muted-foreground">
                              Your Twitter/X handle (e.g., @username)
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="instagram_url">Instagram URL</Label>
                            <Input
                              id="instagram_url"
                              value={siteSettings.instagram_url || ""}
                              onChange={(e) => updateSiteSetting("instagram_url", e.target.value)}
                              placeholder="https://instagram.com/yourprofile"
                            />
                            <p className="text-xs text-muted-foreground">
                              Full URL to your Instagram profile
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="facebook_url">Facebook URL</Label>
                            <Input
                              id="facebook_url"
                              value={siteSettings.facebook_url || ""}
                              onChange={(e) => updateSiteSetting("facebook_url", e.target.value)}
                              placeholder="https://facebook.com/yourpage"
                            />
                            <p className="text-xs text-muted-foreground">
                              Full URL to your Facebook page
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="discord_url">Discord Invite URL</Label>
                            <Input
                              id="discord_url"
                              value={siteSettings.discord_url || ""}
                              onChange={(e) => updateSiteSetting("discord_url", e.target.value)}
                              placeholder="https://discord.gg/yourserver"
                            />
                            <p className="text-xs text-muted-foreground">
                              Invite link to your Discord server
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-border pt-6">
                        <Label htmlFor="turnstile_site_key">Turnstile Site Key</Label>
                        <Input
                          id="turnstile_site_key"
                          value={siteSettings.turnstile_site_key || ""}
                          onChange={(e) => updateSiteSetting("turnstile_site_key", e.target.value)}
                          placeholder="0x4AAAAAACMX7o8e260x6gzV"
                        />
                        <p className="text-xs text-muted-foreground">
                          Cloudflare Turnstile site key for CAPTCHA verification. Make sure to add both your preview and published domains in Cloudflare Turnstile dashboard.
                        </p>
                      </div>

                      <Button type="submit" disabled={isSavingSiteSettings}>
                        {isSavingSiteSettings ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Settings"
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="font-display">About Site Metadata</CardTitle>
                  <CardDescription>
                    How these settings affect your site
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    <strong>Note:</strong> These settings are stored in the database and can be used throughout your application. 
                    However, the HTML meta tags in the page head are static and need to be manually updated in the code 
                    for changes to appear in search engines and social media previews.
                  </p>
                  <p>
                    For immediate SEO/social sharing changes, contact your developer to update the index.html file.
                  </p>
                </CardContent>
              </Card>

              {/* Theme Customization Section */}
              <ThemeCustomizer />
            </TabsContent>
          )}
        </Tabs>

        {/* Sale Details Dialog */}
        <Dialog open={showSaleDialog} onOpenChange={setShowSaleDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Sale Details</DialogTitle>
              <DialogDescription>
                Enter the price and condition for this game listing.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sale-price">Price ($)</Label>
                <Input
                  id="sale-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={importSalePrice}
                  onChange={(e) => setImportSalePrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select 
                  value={importSaleCondition || ""} 
                  onValueChange={(v) => setImportSaleCondition(v as SaleCondition)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {SALE_CONDITION_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowSaleDialog(false);
                  setImportSalePrice("");
                  setImportSaleCondition(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setImportAsForSale(true);
                  setShowSaleDialog(false);
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Location Dialog - shown after import for non-Coming Soon games */}
        <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Set Storage Location
              </DialogTitle>
              <DialogDescription>
                Where will you store "{lastImportedGameTitle}"? (Optional)
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="location-room">Room</Label>
                <Input
                  id="location-room"
                  value={importLocationRoom}
                  onChange={(e) => setImportLocationRoom(e.target.value)}
                  placeholder="e.g., Living Room, Game Room, Office"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-shelf">Shelf</Label>
                <Input
                  id="location-shelf"
                  value={importLocationShelf}
                  onChange={(e) => setImportLocationShelf(e.target.value)}
                  placeholder="e.g., Top Shelf, Kallax #3, Cabinet A"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowLocationDialog(false);
                  setImportLocationRoom("");
                  setImportLocationShelf("");
                  setLastImportedGameTitle("");
                }}
              >
                Skip
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  // Update the game with location info
                  if (importLocationRoom || importLocationShelf) {
                    // Find the game and update it
                    const { data: recentGames } = await supabase
                      .from("games")
                      .select("id")
                      .eq("title", lastImportedGameTitle)
                      .order("created_at", { ascending: false })
                      .limit(1);
                    
                    if (recentGames && recentGames.length > 0) {
                      await supabase
                        .from("games")
                        .update({
                          location_room: importLocationRoom.trim() || null,
                          location_shelf: importLocationShelf.trim() || null,
                        })
                        .eq("id", recentGames[0].id);
                      
                      queryClient.invalidateQueries({ queryKey: ["games"] });
                      toast({
                        title: "Location saved",
                        description: `Storage location for "${lastImportedGameTitle}" has been set.`,
                      });
                    }
                  }
                  setShowLocationDialog(false);
                  setImportLocationRoom("");
                  setImportLocationShelf("");
                  setLastImportedGameTitle("");
                }}
              >
                Save Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Settings;
