import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Settings, Users, Ticket, Copy, Trash2, Plus,
  Calendar, Loader2, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  useClub, useClubLibraries, useClubInviteCodes, useClubEvents,
  useGenerateInviteCode, useRemoveClubLibrary, useUpdateClub,
  useCreateClubEvent, useDeleteClubEvent,
} from "@/hooks/useClubs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { format } from "date-fns";

export default function ClubDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: club, isLoading } = useClub(slug || null);
  const { data: libraries = [] } = useClubLibraries(club?.id || null);
  const { data: inviteCodes = [] } = useClubInviteCodes(club?.id || null);
  const { data: events = [] } = useClubEvents(club?.id || null);

  const generateCode = useGenerateInviteCode();
  const removeLibrary = useRemoveClubLibrary();
  const updateClub = useUpdateClub();
  const createEvent = useCreateClubEvent();
  const deleteEvent = useDeleteClubEvent();

  const [showEventDialog, setShowEventDialog] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDesc, setEventDesc] = useState("");

  const isOwner = club?.owner_id === user?.id;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading...</div>
      </div>
    );
  }

  if (!club || !isOwner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center">
        <div className="text-center text-cream">
          <h1 className="text-2xl font-display mb-4">Not Authorized</h1>
          <Link to="/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
        </div>
      </div>
    );
  }

  const handleGenerateCode = async () => {
    try {
      const result = await generateCode.mutateAsync({ club_id: club.id });
      toast({ title: "Invite code generated!", description: `Code: ${result.code}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: `Code ${code} copied to clipboard` });
  };

  const handleRemoveLibrary = async (libraryId: string) => {
    try {
      await removeLibrary.mutateAsync({ club_id: club.id, library_id: libraryId });
      toast({ title: "Library removed from club" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEvent.mutateAsync({
        club_id: club.id,
        title: eventTitle,
        description: eventDesc || undefined,
        event_date: new Date(eventDate).toISOString(),
        event_location: eventLocation || undefined,
      });
      toast({ title: "Event created!" });
      setShowEventDialog(false);
      setEventTitle("");
      setEventDate("");
      setEventLocation("");
      setEventDesc("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleTogglePublic = async () => {
    try {
      await updateClub.mutateAsync({ club_id: club.id, is_public: !club.is_public });
      toast({ title: club.is_public ? "Club set to private" : "Club set to public" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark">
      <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard?tab=clubs" className="text-cream/70 hover:text-cream">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-display text-2xl font-bold text-cream">
              {club.name} — Management
            </h1>
            <Badge variant={club.status === "approved" ? "secondary" : "outline"}>
              {club.status}
            </Badge>
          </div>
          <Link to={`/club/${club.slug}`}>
            <Button variant="secondary" size="sm" className="gap-2">
              <ExternalLink className="h-4 w-4" /> View Club Page
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="members" className="w-full">
          <TabsList className="mb-6 bg-wood-dark/60 border border-wood-medium/40">
            <TabsTrigger value="members" className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
              <Users className="h-4 w-4" /> Members ({libraries.length})
            </TabsTrigger>
            <TabsTrigger value="invites" className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
              <Ticket className="h-4 w-4" /> Invite Codes
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
              <Calendar className="h-4 w-4" /> Events
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
              <Settings className="h-4 w-4" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* Members */}
          <TabsContent value="members">
            <div className="space-y-3">
              {libraries.map((cl: any) => (
                <Card key={cl.id} className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-display font-semibold">{cl.library?.name || "Unknown"}</p>
                      <p className="text-sm text-cream/60">
                        Joined {format(new Date(cl.joined_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {cl.library?.slug && (
                        <a href={getLibraryUrl(cl.library.slug, "/")}>
                          <Button variant="ghost" size="sm" className="text-cream/70">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => handleRemoveLibrary(cl.library_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {libraries.length === 0 && (
                <p className="text-cream/50 text-center py-8">
                  No libraries yet. Generate an invite code and share it!
                </p>
              )}
            </div>
          </TabsContent>

          {/* Invite Codes */}
          <TabsContent value="invites">
            <div className="mb-4">
              <Button onClick={handleGenerateCode} disabled={generateCode.isPending} className="bg-secondary text-secondary-foreground gap-2">
                {generateCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Generate New Code
              </Button>
            </div>
            <div className="space-y-3">
              {inviteCodes.map((ic) => (
                <Card key={ic.id} className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-mono text-lg tracking-widest text-secondary">{ic.code}</p>
                      <p className="text-xs text-cream/60 mt-1">
                        Used {ic.uses}{ic.max_uses ? `/${ic.max_uses}` : ""} times
                        {ic.expires_at && ` · Expires ${format(new Date(ic.expires_at), "MMM d")}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => copyCode(ic.code)} className="text-cream/70 gap-2">
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {inviteCodes.length === 0 && (
                <p className="text-cream/50 text-center py-8">No invite codes yet</p>
              )}
            </div>
          </TabsContent>

          {/* Events */}
          <TabsContent value="events">
            <div className="mb-4">
              <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-secondary text-secondary-foreground gap-2">
                    <Plus className="h-4 w-4" /> Add Event
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Club Event</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateEvent} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Date & Time</Label>
                      <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Location (optional)</Label>
                      <Input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description (optional)</Label>
                      <Textarea value={eventDesc} onChange={(e) => setEventDesc(e.target.value)} rows={3} />
                    </div>
                    <Button type="submit" className="w-full bg-secondary text-secondary-foreground" disabled={createEvent.isPending}>
                      {createEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Create Event
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-3">
              {events.map((ev) => (
                <Card key={ev.id} className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-display font-semibold">{ev.title}</p>
                      <p className="text-sm text-cream/60">
                        {format(new Date(ev.event_date), "MMM d, yyyy 'at' h:mm a")}
                        {ev.event_location && ` · ${ev.event_location}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400"
                      onClick={() => deleteEvent.mutate({ event_id: ev.id, club_id: club.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {events.length === 0 && (
                <p className="text-cream/50 text-center py-8">No events yet</p>
              )}
            </div>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings">
            <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream max-w-lg">
              <CardHeader>
                <CardTitle className="font-display">Club Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-cream">Public Visibility</Label>
                    <p className="text-xs text-cream/60">Show in the public directory</p>
                  </div>
                  <Switch checked={club.is_public} onCheckedChange={handleTogglePublic} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
