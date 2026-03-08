import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, message } = await req.json();

    if (!token || !message) {
      return new Response(
        JSON.stringify({ error: "Token and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Message too long (max 5000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate the token
    const { data: tokenData, error: tokenError } = await supabase
      .from("feedback_reply_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired reply link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenData.used_at) {
      return new Response(
        JSON.stringify({ error: "This reply link has already been used" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This reply link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the user's reply as a feedback note
    const authorName = tokenData.recipient_name || tokenData.recipient_email || "User";
    const { error: noteError } = await supabase
      .from("feedback_notes")
      .insert({
        feedback_id: tokenData.feedback_id,
        author_id: "00000000-0000-0000-0000-000000000000", // System/anonymous user
        author_name: authorName,
        content: message,
        note_type: "user_reply",
      });

    if (noteError) {
      console.error("Failed to insert feedback note:", noteError);
      return new Response(
        JSON.stringify({ error: "Failed to save your reply" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark token as used
    await supabase
      .from("feedback_reply_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    // Mark the feedback ticket as updated and unread so staff sees it
    await supabase
      .from("platform_feedback")
      .update({ 
        is_read: false, 
        updated_at: new Date().toISOString(),
        status: "open" // Re-open if it was closed
      })
      .eq("id", tokenData.feedback_id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("submit-feedback-reply error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Failed to process reply" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
