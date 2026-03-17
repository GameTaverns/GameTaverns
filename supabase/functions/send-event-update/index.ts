import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SMTP_SEND_TIMEOUT_MS = 30_000;

type UpdateType = "cancelled" | "rescheduled";

interface EventUpdateRequest {
  event_id: string;
  update_type: UpdateType;
  message?: string;
  new_date?: string;
  new_end_date?: string;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function buildUpdateEmail(params: {
  attendeeName: string;
  eventTitle: string;
  updateType: UpdateType;
  originalDate: string;
  newDate?: string;
  location: string;
  message?: string;
  eventUrl: string;
}): string {
  const isCancelled = params.updateType === "cancelled";

  const headerBg = isCancelled ? "#8b2500" : "#b45309";
  const headerText = isCancelled ? "Event Cancelled" : "Event Rescheduled";

  const mainContent = isCancelled
    ? `We're sorry to let you know that <strong>${params.eventTitle}</strong> has been cancelled.`
    : `<strong>${params.eventTitle}</strong> has been rescheduled to a new date.`;

  const dateSection = isCancelled
    ? `<tr><td style="padding:6px 12px 6px 0;color:#78705e;font-size:13px;width:100px;vertical-align:top;">Original Date</td><td style="padding:6px 0;color:#3d2b1f;font-size:13px;text-decoration:line-through;">${params.originalDate}</td></tr>`
    : [
        `<tr><td style="padding:6px 12px 6px 0;color:#78705e;font-size:13px;width:100px;vertical-align:top;">Was</td><td style="padding:6px 0;color:#3d2b1f;font-size:13px;text-decoration:line-through;">${params.originalDate}</td></tr>`,
        `<tr><td style="padding:6px 12px 6px 0;color:#78705e;font-size:13px;vertical-align:top;">Now</td><td style="padding:6px 0;color:#3d2b1f;font-size:13px;font-weight:600;">${params.newDate}</td></tr>`,
      ].join("");

  const messageSection = params.message
    ? `<div style="background:#fff8e1;border:1px solid #d4c4a0;border-radius:6px;padding:14px;margin:0 0 24px;font-size:13px;color:#3d2b1f;"><strong>Message from the host:</strong><br/>${params.message}</div>`
    : "";

  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#e8dcc8;font-family:Georgia,Times New Roman,serif;">',
    '<div style="max-width:560px;margin:0 auto;padding:24px;">',
    '<div style="background:#f5eed9;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(60,40,20,0.15);border:1px solid #d4c4a0;">',
    `<div style="background:${headerBg};padding:24px 32px;text-align:center;">`,
    '<img src="https://gametaverns.com/gt-logo.png" alt="GameTaverns" style="max-height:48px;margin-bottom:4px;" />',
    `<p style="margin:0;color:#f5eed9;font-size:14px;font-family:Georgia,serif;font-weight:600;">${headerText}</p>`,
    '</div>',
    '<div style="padding:32px;">',
    `<p style="margin:0 0 16px;font-size:15px;color:#3d2b1f;">Hi ${params.attendeeName},</p>`,
    `<p style="margin:0 0 20px;font-size:15px;color:#3d2b1f;">${mainContent}</p>`,
    '<div style="background:#efe5cf;border:1px solid #d4c4a0;border-radius:8px;padding:20px;margin:0 0 24px;">',
    '<table style="width:100%;border-collapse:collapse;">',
    `<tr><td style="padding:6px 12px 6px 0;color:#78705e;font-size:13px;width:100px;vertical-align:top;">Event</td><td style="padding:6px 0;color:#3d2b1f;font-size:13px;font-weight:600;">${params.eventTitle}</td></tr>`,
    dateSection,
    `<tr><td style="padding:6px 12px 6px 0;color:#78705e;font-size:13px;vertical-align:top;">Location</td><td style="padding:6px 0;color:#3d2b1f;font-size:13px;">${params.location || "TBD"}</td></tr>`,
    '</table>',
    '</div>',
    messageSection,
    '<div style="text-align:center;">',
    `<a href="${params.eventUrl}" style="display:inline-block;background:#556b2f;color:#f5eed9;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">View Event Details</a>`,
    '</div>',
    '<hr style="border:none;border-top:1px solid #d4c4a0;margin:24px 0;">',
    '<p style="margin:0;font-size:12px;color:#9a8a6e;text-align:center;">Sent by GameTaverns</p>',
    '</div></div></div>',
    '</body></html>',
  ].join("");
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: EventUpdateRequest = await req.json();
    const { event_id, update_type, message, new_date, new_end_date } = body;

    if (!event_id || !update_type) {
      return new Response(
        JSON.stringify({ error: "Missing event_id or update_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch event
    const { data: event, error: eventErr } = await supabase
      .from("library_events")
      .select("id, title, description, event_date, end_date, event_location, venue_name, venue_address, max_attendees")
      .eq("id", event_id)
      .single();

    if (eventErr || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all active registrations
    const { data: registrations, error: regErr } = await supabase
      .from("event_registrations")
      .select("attendee_name, attendee_email")
      .eq("event_id", event_id)
      .in("status", ["registered", "waitlisted"]);

    if (regErr) {
      console.error("Failed to fetch registrations:", regErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch attendees" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const attendeesWithEmail = (registrations || []).filter(
      (r: any) => r.attendee_email && r.attendee_email.trim()
    );

    if (attendeesWithEmail.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No attendees with email to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build display strings
    const originalDate = new Date(event.event_date).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });

    const newDateStr = new_date
      ? new Date(new_date).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          hour: "numeric", minute: "2-digit", timeZoneName: "short",
        })
      : undefined;

    const location = event.venue_name
      ? `${event.venue_name}${event.venue_address ? `, ${event.venue_address}` : ""}`
      : event.event_location || "";

    const siteUrl = Deno.env.get("SITE_URL") || "https://gametaverns.com";
    const eventUrl = `${siteUrl}/event/${event.id}`;

    // SMTP config
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPass = Deno.env.get("SMTP_PASS") || "";
    const smtpFrom = Deno.env.get("SMTP_FROM");

    if (!smtpHost || !smtpFrom) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isRelay = smtpPort === 25;
    const requiresAuth = !!(smtpUser && smtpPass) && !isRelay;
    const useTls = smtpPort === 465;

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: useTls,
        auth: requiresAuth ? { username: smtpUser, password: smtpPass } : undefined,
      },
      debug: {
        noStartTLS: isRelay,
        allowUnsecure: isRelay,
      },
    });

    const subject = update_type === "cancelled"
      ? `Cancelled: ${event.title}`
      : `Rescheduled: ${event.title}`;

    let sentCount = 0;
    let failCount = 0;

    for (const attendee of attendeesWithEmail) {
      const html = buildUpdateEmail({
        attendeeName: attendee.attendee_name,
        eventTitle: event.title,
        updateType: update_type,
        originalDate,
        newDate: newDateStr,
        location,
        message,
        eventUrl,
      });

      try {
        await withTimeout(
          client.send({
            from: smtpFrom,
            to: attendee.attendee_email,
            subject,
            html,
          }),
          SMTP_SEND_TIMEOUT_MS,
          `SMTP to ${attendee.attendee_email}`
        );
        sentCount++;
      } catch (e) {
        console.error(`Failed to email ${attendee.attendee_email}:`, e);
        failCount++;
      }
    }

    await client.close();

    console.log(`Event update emails: ${sentCount} sent, ${failCount} failed for event ${event_id}`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-event-update error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
