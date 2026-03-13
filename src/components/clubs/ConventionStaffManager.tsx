import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Shield, Users, Crown, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ConventionStaffManagerProps {
  clubId: string;
}

interface ClubMember {
  userId: string;
  displayName: string;
  libraryName: string;
}

const STAFF_ROLES = [
  { value: "volunteer", label: "Volunteer", icon: UserCheck, description: "Can use Command + Lending Desk" },
  { value: "lead", label: "Lead", icon: Crown, description: "Volunteer + can manage other volunteers" },
] as const;

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

  const updateStaffRole = useMutation({
    mutationFn: async ({ conventionEventId, userId, role }: {
      conventionEventId: string; userId: string; role: string;
    }) => {
      const { error } = await supabase
        .from("convention_staff")
        .update({ role })
        .eq("convention_event_id", conventionEventId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convention-staff-list", expandedEventId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update role");
    },
  });

  if (conventionEvents.length === 0) {
    return null;
  }

  const staffMap = new Map(currentStaff.map((s: any) => [s.user_id, s]));

  return (
    <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Convention Staff
        </CardTitle>
        <p className="text-xs text-cream/60">
          Assign club members as convention volunteers — they'll get access to the Command Center and Lending Desk
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
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-cream/50" />
                    : <ChevronRight className="h-4 w-4 text-cream/50" />
                  }
                  <div>
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-cream/50">
                      {event.event_date && format(new Date(event.event_date), "MMM d, yyyy")}
                      {event.venue_name && ` · ${event.venue_name}`}
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
                <div className="border-t border-wood-medium/30 p-3 space-y-1">
                  {clubMembers.length === 0 ? (
                    <p className="text-sm text-cream/50 text-center py-4">
                      No club members found. Add libraries to this club first.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between px-2 pb-2 text-xs text-cream/40 uppercase tracking-wider">
                        <span>Member</span>
                        <div className="flex items-center gap-8">
                          <span>Role</span>
                          <span className="w-10 text-center">Staff</span>
                        </div>
                      </div>
                      {clubMembers.map((member) => {
                        const staffRecord = staffMap.get(member.userId);
                        const isStaff = !!staffRecord;
                        return (
                          <div
                            key={member.userId}
                            className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-wood-medium/15 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{member.displayName}</p>
                              <p className="text-xs text-cream/40">{member.libraryName}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {isStaff && (
                                <Select
                                  value={staffRecord.role || "volunteer"}
                                  onValueChange={(role) =>
                                    updateStaffRole.mutate({
                                      conventionEventId: ce.id,
                                      userId: member.userId,
                                      role,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-7 w-28 text-xs bg-wood-medium/30 border-wood-medium/40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STAFF_ROLES.map((r) => (
                                      <SelectItem key={r.value} value={r.value} className="text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <r.icon className="h-3 w-3" />
                                          {r.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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
                      })}
                      {currentStaff.length > 0 && (
                        <p className="text-xs text-cream/40 pt-2 px-2">
                          {currentStaff.length} of {clubMembers.length} members assigned as staff
                        </p>
                      )}
                    </>
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
