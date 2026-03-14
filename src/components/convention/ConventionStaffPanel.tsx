import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Shield, Users, Crown, UserCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  conventionEventId: string;
  clubId: string;
}

interface ClubMember {
  userId: string;
  displayName: string;
  libraryName: string;
}

const STAFF_ROLES = [
  { value: "volunteer", label: "Volunteer", icon: UserCheck, description: "Command + Lending Desk" },
  { value: "lead", label: "Lead", icon: Crown, description: "Volunteer + manage others" },
] as const;

export function ConventionStaffPanel({ conventionEventId, clubId }: Props) {
  const queryClient = useQueryClient();

  // Fetch club members
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

  // Fetch current staff
  const { data: currentStaff = [] } = useQuery({
    queryKey: ["convention-staff-list", conventionEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convention_staff")
        .select("id, user_id, role, display_name")
        .eq("convention_event_id", conventionEventId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!conventionEventId,
  });

  const toggleStaff = useMutation({
    mutationFn: async ({ userId, displayName, isAdding }: {
      userId: string; displayName: string; isAdding: boolean;
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
      queryClient.invalidateQueries({ queryKey: ["convention-staff-list", conventionEventId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update staff"),
  });

  const updateStaffRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("convention_staff")
        .update({ role })
        .eq("convention_event_id", conventionEventId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convention-staff-list", conventionEventId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update role"),
  });

  const staffMap = new Map(currentStaff.map((s: any) => [s.user_id, s]));

  if (clubMembers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-3">
        No club members found. Add libraries to the club first.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          <span>{currentStaff.length} of {clubMembers.length} assigned</span>
        </div>
      </div>
      {clubMembers.map((member) => {
        const staffRecord = staffMap.get(member.userId);
        const isStaff = !!staffRecord;
        return (
          <div
            key={member.userId}
            className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{member.displayName}</p>
              <p className="text-xs text-muted-foreground">{member.libraryName}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isStaff && (
                <Select
                  value={staffRecord.role || "volunteer"}
                  onValueChange={(role) =>
                    updateStaffRole.mutate({ userId: member.userId, role })
                  }
                >
                  <SelectTrigger className="h-7 w-24 text-xs">
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
    </div>
  );
}
