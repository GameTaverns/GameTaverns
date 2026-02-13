import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Export handler for self-hosted router
export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's token to verify they're an admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin using the has_role function
    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Only admins can manage users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for user management
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { action, email, password, role, userId } = body;
    
    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing 'action' field in request body", receivedBody: body }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "create": {
        if (!email || !password) {
          return new Response(
            JSON.stringify({ error: "Email and password are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create the user
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm the email
        });

        if (createError) {
          return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Assign role if specified and not "user" (default)
        if (role && role !== "user" && newUser.user) {
          const { error: roleError } = await adminClient
            .from("user_roles")
            .insert({ user_id: newUser.user.id, role });

          if (roleError) {
            console.error("Error assigning role:", roleError);
          }
        }

        return new Response(
          JSON.stringify({ success: true, user: { id: newUser.user?.id, email: newUser.user?.email } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "User ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Prevent self-deletion
        if (userId === user.id) {
          return new Response(
            JSON.stringify({ error: "Cannot delete your own account" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Cleanup dependent rows with error logging.
        // The service role key bypasses RLS, so these should all succeed.
        console.log(`[manage-users] Deleting user ${userId} - starting cleanup...`);

        const cleanupTables = [
          { table: "user_roles", column: "user_id" },
          { table: "library_members", column: "user_id" },
          { table: "library_followers", column: "follower_user_id" },
          { table: "notification_preferences", column: "user_id" },
          { table: "user_totp_settings", column: "user_id" },
          { table: "email_confirmation_tokens", column: "user_id" },
          { table: "password_reset_tokens", column: "user_id" },
        ];

        for (const { table, column } of cleanupTables) {
          const { error } = await adminClient.from(table).delete().eq(column, userId);
          if (error) {
            console.error(`[manage-users] Failed to delete from ${table}:`, error.message);
          }
        }

        // Critical: Delete user_profiles to release the unique username constraint
        const { error: profileError, count: profileCount } = await adminClient
          .from("user_profiles")
          .delete()
          .eq("user_id", userId)
          .select();
        
        if (profileError) {
          console.error(`[manage-users] CRITICAL: Failed to delete user_profiles for ${userId}:`, profileError.message);
          // Don't proceed if we can't delete the profile - username would remain stuck
          return new Response(
            JSON.stringify({ error: `Failed to delete user profile: ${profileError.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.log(`[manage-users] Deleted user_profiles record for ${userId}`);

        // Finally delete the auth user
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: deleteError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list": {
        // List all users using admin API
        const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();

        if (listError) {
          return new Response(
            JSON.stringify({ error: listError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get all roles
        const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
        
        // Get all profiles for display names and usernames
        const { data: profiles } = await adminClient.from("user_profiles").select("user_id, display_name, username");

        // Get all library owners (users who own at least one library)
        const { data: libraryOwners } = await adminClient.from("libraries").select("owner_id");
        const libraryOwnerSet = new Set(libraryOwners?.map((l) => l.owner_id) || []);

        // Get all library moderators (users with moderator role in library_members)
        const { data: libraryModerators } = await adminClient
          .from("library_members")
          .select("user_id")
          .eq("role", "moderator");
        const libraryModeratorSet = new Set(libraryModerators?.map((m) => m.user_id) || []);

        // Map roles and profiles to users
        const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) || []);
        const profileMap = new Map(profiles?.map((p) => [p.user_id, { display_name: p.display_name, username: p.username }]) || []);
        
        const usersWithRoles = users.map((u) => {
          // Determine effective role:
          // 1. Explicit role in user_roles takes precedence
          // 2. If no explicit role but owns a library, they're an "owner"
          // 3. If no explicit role but is a library moderator, they're a "moderator"
          // 4. Otherwise, no role (regular user)
          let effectiveRole = roleMap.get(u.id) || null;
          if (!effectiveRole && libraryOwnerSet.has(u.id)) {
            effectiveRole = "owner";
          } else if (!effectiveRole && libraryModeratorSet.has(u.id)) {
            effectiveRole = "moderator";
          }
          
          return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            email_confirmed_at: u.email_confirmed_at || null,
            role: effectiveRole,
            display_name: profileMap.get(u.id)?.display_name || null,
            username: profileMap.get(u.id)?.username || null,
            is_banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
            banned_until: u.banned_until,
            is_library_owner: libraryOwnerSet.has(u.id),
            is_library_moderator: libraryModeratorSet.has(u.id),
          };
        });

        return new Response(
          JSON.stringify({ users: usersWithRoles }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "suspend": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "User ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Prevent self-suspension
        if (userId === user.id) {
          return new Response(
            JSON.stringify({ error: "Cannot suspend your own account" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { duration, reason } = body;
        
        // Calculate ban duration string for Supabase
        let banDuration: string;
        if (duration === "permanent") {
          banDuration = "876000h"; // ~100 years
        } else if (duration === "7d") {
          banDuration = "168h";
        } else if (duration === "30d") {
          banDuration = "720h";
        } else if (duration === "90d") {
          banDuration = "2160h";
        } else {
          banDuration = "168h"; // Default 7 days
        }

        // Use the ban_duration parameter which is the correct Supabase Admin API field
        const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: banDuration,
          user_metadata: reason ? { suspension_reason: reason } : undefined,
        });

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "unsuspend": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "User ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Use "none" to clear ban
        const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "resend_confirmation": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "User ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get the user's email
        const { data: targetUserData, error: targetUserError } = await adminClient.auth.admin.getUserById(userId);
        if (targetUserError || !targetUserData?.user) {
          return new Response(
            JSON.stringify({ error: "User not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if already confirmed
        if (targetUserData.user.email_confirmed_at) {
          return new Response(
            JSON.stringify({ error: "User email is already confirmed" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const targetEmail = targetUserData.user.email;
        if (!targetEmail) {
          return new Response(
            JSON.stringify({ error: "User has no email address" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Call send-auth-email to resend the confirmation
        // Pass userId to avoid redundant listUsers() call which can timeout
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sendEmailUrl = `${supabaseUrl}/functions/v1/send-auth-email`;

        const emailRes = await fetch(sendEmailUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: Deno.env.get("SUPABASE_ANON_KEY") || serviceKey,
          },
          body: JSON.stringify({
            type: "email_confirmation",
            email: targetEmail,
            userId: userId,
          }),
        });

        if (!emailRes.ok) {
          const errBody = await emailRes.text().catch(() => "Unknown error");
          console.error(`[manage-users] Failed to resend confirmation email: ${errBody}`);
          return new Response(
            JSON.stringify({ error: "Failed to send confirmation email" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Confirmation email resent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Error in manage-users:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// For Lovable Cloud deployment (direct function invocation)
Deno.serve(handler);
