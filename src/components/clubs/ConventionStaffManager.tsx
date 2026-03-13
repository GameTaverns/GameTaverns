import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronRight, Shield, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ConventionStaffManagerProps {
  clubId: string;
}

interface ClubMember {
  userId: string;
  displayName: string;
  libraryName: string;
}

export function ConventionStaffManager({ clubId }: ConventionStaffManagerProps) {
  const queryClient = useQueryClient();
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Fetch convention events for this club
  const { data: conventionEvents = [] } = useQuery({
    queryKey: ["club-convention-events", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convention_events")
        .select("id, event_id, library_events:library_events!convention_events_event_id_fkey(id, title, event_date, venue_name, status)")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  // Fetch club members (library owners + library members in the club)
  const { data: clubMembers = [] } = useQuery({
    queryKey: ["club-members-for-staff", clubId],
    queryFn: async () => {
      const { data: clubLibs, error: clError } = await supabase
        .from("club_libraries")
        .select("library_id, library:libraries(id, name, owner_id)")
        .eq("club_id", clubId);
      if (clError) throw clError;

      const members: ClubMember[] = [];
      const seenUserIds = new Set<string>();

      for (const cl of clubLibs || []) {
        const lib = cl.library as any;
        if (!lib) continue;

        // Add library owner
        if (lib.owner_id && !seenUserIds.has(lib.owner_id)) {
          seenUserIds.add(lib.owner_id);
          // Get display name
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("display_name, username")
            .eq("user_id", lib.owner_id)
            .maybeSingle();
          members.push({
            userId: lib.owner_id,
            displayName: profile?.display_name || profile?.username || "Unknown",
            libraryName: lib.name,
          });
        }

        // Add library members
        const { data: libMembers } = await supabase
          .from("library_members")
          .select("user_id")
          .eq("library_id", lib.id);

        for (const lm of libMembers || []) {
          if (!seenUserIds.has(lm.user_id)) {
            seenUserIds.add(lm.user_id);
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("display_name, username")
              .eq("user_id", lm.user_id)
              .maybeSingle();
            members.push({
              userId: lm.user_id,
              displayName: profile?.display_name || profile?.username || "Unknown",
              libraryName: lib.name,
            });
          }
        }
      }

      return members;
    },
    enabled: !!clubId,
    staleTime: 60000,
  });

  // Fetch current staff for expanded event
  const { data: currentStaff = [] } = useQuery({
    queryKey: ["convention-staff-list", expandedEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convention_staff")
        .select("id, user_id, role, display_name")
        .eq("convention_event_id", expandedEventId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!expandedEventId,
  });

  const toggleStaff = useMutation({
    mutationFn: async ({ conventionEventId, userId, displayName, isAdding }: {
      conventionEventId: string; userId: string; displayName: string; isAdding: boolean;
    }) => {
      if (isAdding) {
        const { error } = await supabase
          .from("convention_staff")
          .insert({
            convention_event_id: conventionEventId,
            user_id: userId,
            display_name: displayName,
            role: "volunteer",
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("convention_staff")
          .delete()
          .eq("convention_event_id", conventionEventId)
          .eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convention-staff-list", expandedEventId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update staff");
    },
  });

  if (conventionEvents.length === 0) {
    return null; // No convention events for this club
  }

  const staffUserIds = new Set(currentStaff.map((s: any) => s.user_id));

  return (
    <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Convention Staff
        </CardTitle>
        <p className="text-xs text-cream/60">
          Assign club members as convention volunteers for each event
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {conventionEvents.map((ce: any) => {
          const event = ce.library_events;
          if (!event) return null;
          const isExpanded = expandedEventId === ce.id;
          const staffCount = isExpanded ? currentStaff.length : null;

          return (
            <div key={ce.id} className="rounded-lg border border-wood-medium/40 overflow-hidden">
              <button
                onClick={() => setExpandedEventId(isExpanded ? null : ce.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-wood-medium/20 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-cream/50" /> : <ChevronRight className="h-4 w-4 text-cream/50" />}
                  <div>
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-cream/50">
                      {event.venue_name && `${event.venue_name} · `}
                      {event.status}
                    </p>
                  </div>
                </div>
                {staffCount !== null && (
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" /> {staffCount} staff
                  </Badge>
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-wood-medium/30 p-3 space-y-2">
                  {clubMembers.length === 0 ? (
                    <p className="text-sm text-cream/50 text-center py-2">No club members found</p>
                  ) : (
                    clubMembers.map((member) => {
                      const isStaff = staffUserIds.has(member.userId);
                      return (
                        <div key={member.userId} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-wood-medium/10">
                          <div>
                            <p className="text-sm font-medium">{member.displayName}</p>
                            <p className="text-xs text-cream/50">{member.libraryName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isStaff && (
                              <Badge variant="outline" className="text-xs border-secondary/40 text-secondary">
                                Volunteer
                              </Badge>
                            )}
                            <Switch
                              checked={isStaff}
                              disabled={toggleStaff.isPending}
                              onCheckedChange={(checked) =>
                                toggleStaff.mutate({
                                  conventionEventId: ce.id,
                                  userId: member.userId,
                                  displayName: member.displayName,
                                  isAdding: checked,
                                })
                              }
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
