import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomCode(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (const b of bytes) code += chars[b % chars.length];
  return code;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey)
      throw new Error("Missing backend configuration");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return json({ error: "Unauthorized" }, 401);

    const token = authHeader.slice(7);
    const supabase = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ error: "Invalid token" }, 401);

    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      // ── Request a new club (goes to admin inbox) ──
      case "request_club": {
        const { name, slug, description, is_public } = body;
        if (!name || !slug)
          return json({ error: "Name and slug required" }, 400);

        const { data, error } = await supabase
          .from("clubs")
          .insert({
            name,
            slug: slug.toLowerCase(),
            description: description || null,
            owner_id: user.id,
            status: "pending",
            is_public: is_public ?? false,
          })
          .select()
          .single();
        if (error) throw error;

        // Auto-add the owner's first library to the club
        const { data: ownerLib } = await supabase
          .from("libraries")
          .select("id")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (ownerLib) {
          await supabase
            .from("club_libraries")
            .insert({ club_id: data.id, library_id: ownerLib.id })
            .select();
        }

        return json(data);
      }

      // ── Admin: approve a club ──
      case "approve_club": {
        const { data: isAdmin } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        if (!isAdmin) return json({ error: "Forbidden" }, 403);

        const { club_id } = body;
        const { data, error } = await supabase
          .from("clubs")
          .update({
            status: "approved",
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          })
          .eq("id", club_id)
          .select()
          .single();
        if (error) throw error;
        return json(data);
      }

      // ── Admin: reject a club ──
      case "reject_club": {
        const { data: isAdmin2 } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        if (!isAdmin2) return json({ error: "Forbidden" }, 403);

        const { club_id: rejectId } = body;
        const { data, error } = await supabase
          .from("clubs")
          .update({ status: "rejected" })
          .eq("id", rejectId)
          .select()
          .single();
        if (error) throw error;
        return json(data);
      }

      // ── Club owner: generate invite code ──
      case "generate_invite_code": {
        const { club_id: codeClubId, max_uses, expires_in_days } = body;

        const { data: isOwner } = await supabase.rpc("is_club_owner", {
          _user_id: user.id,
          _club_id: codeClubId,
        });
        if (!isOwner) return json({ error: "Not club owner" }, 403);

        const code = randomCode();
        const expiresAt = expires_in_days
          ? new Date(
              Date.now() + expires_in_days * 24 * 60 * 60 * 1000
            ).toISOString()
          : null;

        const { data, error } = await supabase
          .from("club_invite_codes")
          .insert({
            club_id: codeClubId,
            code,
            created_by: user.id,
            max_uses: max_uses || null,
            expires_at: expiresAt,
          })
          .select()
          .single();
        if (error) throw error;
        return json(data);
      }

      // ── Library owner: redeem invite code ──
      case "redeem_invite_code": {
        const { code: redeemCode, library_id: redeemLibId } = body;
        if (!redeemCode || !redeemLibId)
          return json({ error: "Code and library_id required" }, 400);

        // Verify user owns the library
        const { data: lib } = await supabase
          .from("libraries")
          .select("id")
          .eq("id", redeemLibId)
          .eq("owner_id", user.id)
          .maybeSingle();
        if (!lib) return json({ error: "Library not found or not yours" }, 403);

        // Find the invite code
        const { data: invite } = await supabase
          .from("club_invite_codes")
          .select("*")
          .eq("code", redeemCode.toUpperCase())
          .eq("is_active", true)
          .maybeSingle();
        if (!invite)
          return json({ error: "Invalid or expired invite code" }, 400);

        // Check expiry
        if (invite.expires_at && new Date(invite.expires_at) < new Date())
          return json({ error: "Invite code has expired" }, 400);

        // Check max uses
        if (invite.max_uses && invite.uses >= invite.max_uses)
          return json({ error: "Invite code max uses reached" }, 400);

        // Check club is approved
        const { data: club } = await supabase
          .from("clubs")
          .select("id, status")
          .eq("id", invite.club_id)
          .maybeSingle();
        if (!club || club.status !== "approved")
          return json({ error: "Club not available" }, 400);

        // Check not already a member
        const { data: existing } = await supabase
          .from("club_libraries")
          .select("id")
          .eq("club_id", invite.club_id)
          .eq("library_id", redeemLibId)
          .maybeSingle();
        if (existing)
          return json({ error: "Library already in this club" }, 400);

        // Add library to club
        const { data: membership, error: joinError } = await supabase
          .from("club_libraries")
          .insert({ club_id: invite.club_id, library_id: redeemLibId })
          .select()
          .single();
        if (joinError) throw joinError;

        // Increment uses
        await supabase
          .from("club_invite_codes")
          .update({ uses: invite.uses + 1 })
          .eq("id", invite.id);

        return json({ ...membership, club_name: undefined });
      }

      // ── Remove library from club ──
      case "remove_library": {
        const { club_id: rmClubId, library_id: rmLibId } = body;

        // Must be club owner or library owner
        const { data: isClubOwner } = await supabase.rpc("is_club_owner", {
          _user_id: user.id,
          _club_id: rmClubId,
        });
        const { data: ownsLib } = await supabase
          .from("libraries")
          .select("id")
          .eq("id", rmLibId)
          .eq("owner_id", user.id)
          .maybeSingle();

        if (!isClubOwner && !ownsLib)
          return json({ error: "Not authorized" }, 403);

        const { error } = await supabase
          .from("club_libraries")
          .delete()
          .eq("club_id", rmClubId)
          .eq("library_id", rmLibId);
        if (error) throw error;
        return json({ success: true });
      }

      // ── Update club ──
      case "update_club": {
        const { club_id: updClubId, ...updates } = body;
        delete updates.action;

        const { data: isOwnerUpd } = await supabase.rpc("is_club_owner", {
          _user_id: user.id,
          _club_id: updClubId,
        });
        const { data: isAdminUpd } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        if (!isOwnerUpd && !isAdminUpd)
          return json({ error: "Not authorized" }, 403);

        // Only allow safe fields
        const safe: Record<string, unknown> = {};
        for (const k of [
          "name",
          "description",
          "is_public",
          "logo_url",
        ]) {
          if (k in updates) safe[k] = updates[k];
        }

        const { data, error } = await supabase
          .from("clubs")
          .update(safe)
          .eq("id", updClubId)
          .select()
          .single();
        if (error) throw error;
        return json(data);
      }

      // ── Cross-library game search ──
      case "search_games": {
        const { club_id: searchClubId, query: searchQuery } = body;
        if (!searchClubId)
          return json({ error: "club_id required" }, 400);

        // Get all library IDs in this club
        const { data: clubLibs } = await supabase
          .from("club_libraries")
          .select("library_id")
          .eq("club_id", searchClubId);

        if (!clubLibs || clubLibs.length === 0)
          return json({ games: [] });

        const libIds = clubLibs.map((cl: any) => cl.library_id);

        let query = supabase
          .from("games")
          .select(
            "id, title, image_url, min_players, max_players, play_time, library_id, bgg_id, copies_owned, is_expansion"
          )
          .in("library_id", libIds)
          .eq("is_expansion", false)
          .order("title");

        if (searchQuery) {
          query = query.ilike("title", `%${searchQuery}%`);
        }

        const { data: games, error: gamesError } = await query.limit(200);
        if (gamesError) throw gamesError;

        // Fetch library names for attribution
        const { data: libs } = await supabase
          .from("libraries")
          .select("id, name, slug")
          .in("id", libIds);

        const libMap = new Map(
          (libs || []).map((l: any) => [l.id, l])
        );

        // Fetch owner display names
        const ownerIds = [
          ...new Set(
            (libs || []).map((l: any) => l.owner_id).filter(Boolean)
          ),
        ];

        // Get owner info from libraries
        const { data: libsWithOwners } = await supabase
          .from("libraries")
          .select("id, owner_id")
          .in("id", libIds);

        const libOwnerMap = new Map(
          (libsWithOwners || []).map((l: any) => [l.id, l.owner_id])
        );

        const allOwnerIds = [
          ...new Set(
            [...libOwnerMap.values()].filter(Boolean)
          ),
        ];

        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("user_id, display_name, username")
          .in("user_id", allOwnerIds);

        const profileMap = new Map(
          (profiles || []).map((p: any) => [p.user_id, p])
        );

        const enrichedGames = (games || []).map((g: any) => {
          const lib = libMap.get(g.library_id) || {};
          const ownerId = libOwnerMap.get(g.library_id);
          const owner = ownerId ? profileMap.get(ownerId) : null;
          return {
            ...g,
            library_name: (lib as any).name || "Unknown",
            library_slug: (lib as any).slug || "",
            owner_name:
              owner?.display_name || owner?.username || "Unknown",
          };
        });

        return json({ games: enrichedGames });
      }

      // ── Club events ──
      case "create_event": {
        const {
          club_id: evClubId,
          title: evTitle,
          description: evDesc,
          event_date,
          event_location,
        } = body;
        if (!evClubId || !evTitle || !event_date)
          return json(
            { error: "club_id, title, event_date required" },
            400
          );

        const { data: isEvOwner } = await supabase.rpc("is_club_owner", {
          _user_id: user.id,
          _club_id: evClubId,
        });
        if (!isEvOwner)
          return json({ error: "Not club owner" }, 403);

        const { data, error } = await supabase
          .from("club_events")
          .insert({
            club_id: evClubId,
            title: evTitle,
            description: evDesc || null,
            event_date,
            event_location: event_location || null,
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        return json(data);
      }

      case "delete_event": {
        const { event_id } = body;
        const { data: ev } = await supabase
          .from("club_events")
          .select("club_id")
          .eq("id", event_id)
          .maybeSingle();
        if (!ev) return json({ error: "Event not found" }, 404);

        const { data: isEvOwner2 } = await supabase.rpc("is_club_owner", {
          _user_id: user.id,
          _club_id: ev.club_id,
        });
        if (!isEvOwner2)
          return json({ error: "Not authorized" }, 403);

        await supabase.from("club_events").delete().eq("id", event_id);
        return json({ success: true });
      }

      // ── List pending clubs (admin) ──
      case "list_pending": {
        const { data: isAdminList } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        if (!isAdminList) return json({ error: "Forbidden" }, 403);

        const { data, error } = await supabase
          .from("clubs")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: true });
        if (error) throw error;

        // Enrich with owner names
        const ownerIds = [
          ...new Set((data || []).map((c: any) => c.owner_id)),
        ];
        const { data: ownerProfiles } = await supabase
          .from("user_profiles")
          .select("user_id, display_name, username")
          .in("user_id", ownerIds);
        const pMap = new Map(
          (ownerProfiles || []).map((p: any) => [p.user_id, p])
        );

        const enriched = (data || []).map((c: any) => {
          const p = pMap.get(c.owner_id);
          return {
            ...c,
            owner_name:
              p?.display_name || p?.username || "Unknown",
          };
        });

        return json(enriched);
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error: any) {
    console.error("Clubs error:", error);
    return json({ error: error?.message || "Server error" }, 500);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
