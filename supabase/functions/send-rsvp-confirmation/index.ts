import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SMTP_SEND_TIMEOUT_MS = 30_000;

interface RsvpEmailRequest {
  event_id: string;
  attendee_name: string;
  attendee_email: string;
  status: "registered" | "waitlisted";
  waitlist_position?: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeIcs(text: string): string {
  return text.replace(/[\\;,\n]/g, (c) =>
    c === "\n" ? "\\n" : `\\${c}`
  );
}

function foldLine(line: string): string {
  // iCalendar spec: lines must be ≤75 octets, continuation with CRLF + space
  const parts: string[] = [];
  while (line.length > 75) {
    parts.push(line.substring(0, 75));
    line = " " + line.substring(75);
  }
  parts.push(line);
  return parts.join("\r\n");
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildIcsContent(event: {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  uid: string;
  organizerEmail: string;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GameTaverns//Event RSVP//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    foldLine(`UID:${event.uid}`),
    `DTSTART:${formatIcsDate(event.startDate)}`,
    `DTEND:${formatIcsDate(event.endDate)}`,
    foldLine(`SUMMARY:${escapeIcs(event.title)}`),
    foldLine(`DESCRIPTION:${escapeIcs(event.description)}`),
    foldLine(`LOCATION:${escapeIcs(event.location)}`),
    foldLine(`ORGANIZER;CN=GameTaverns:mailto:${event.organizerEmail}`),
    `STATUS:CONFIRMED`,
    `SEQUENCE:0`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

function buildGoogleCalendarUrl(event: {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
}): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${fmt(event.startDate)}/${fmt(event.endDate)}`,
    details: event.description,
    location: event.location,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
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

// ── Email HTML builders ────────────────────────────────────────────────────

function buildAttendeeEmail(params: {
  attendeeName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  status: string;
  waitlistPosition?: number | null;
  googleCalUrl: string;
  eventUrl: string;
}): string {
  const isWaitlisted = params.status === "waitlisted";
  const statusBadge = isWaitlisted
    ? `<span style="background:#b45309;color:#fff;padding:4px 12px;border-radius:4px;font-size:13px;">Waitlisted #${params.waitlistPosition}</span>`
    : `<span style="background:#4d7c0f;color:#fff;padding:4px 12px;border-radius:4px;font-size:13px;">&#10003; Confirmed</span>`;

  const calendarSection = isWaitlisted ? "" : [
    '<p style="margin:0 0 12px;font-size:13px;color:#78705e;">Add this event to your calendar:</p>',
    '<div style="margin:0 0 24px;">',
    `<a href="${params.googleCalUrl}" target="_blank" style="display:inline-block;background:#556b2f;color:#f5eed9;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">&#128197; Add to Google Calendar</a>`,
    '</div>',
    '<p style="margin:0 0 8px;font-size:12px;color:#9a8a6e;">An .ics calendar file is also attached for Apple Calendar, Outlook, and other apps.</p>',
  ].join("");

  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#e8dcc8;font-family:Georgia,Times New Roman,serif;">',
    '<div style="max-width:560px;margin:0 auto;padding:24px;">',
    '<div style="background:#f5eed9;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(60,40,20,0.15);border:1px solid #d4c4a0;">',
    '<div style="background:#3d2b1f;padding:24px 32px;">',
    '<h1 style="margin:0;color:#e8d9b0;font-size:20px;font-family:Georgia,serif;">&#127922; GameTaverns</h1>',
    '</div>',
    '<div style="padding:32px;">',
    `<p style="margin:0 0 16px;font-size:15px;color:#3d2b1f;">Hi ${params.attendeeName},</p>`,
    '<p style="margin:0 0 20px;font-size:15px;color:#3d2b1f;">',
    isWaitlisted
      ? `You've been added to the waitlist for <strong>${params.eventTitle}</strong>. We'll let you know if a spot opens up!`
      : `You're confirmed for <strong>${params.eventTitle}</strong>! We can't wait to see you there.`,
    '</p>',
    '<div style="background:#efe5cf;border:1px solid #d4c4a0;border-radius:8px;padding:20px;margin:0 0 24px;">',
    '<table style="width:100%;border-collapse:collapse;">',
    `<tr><td style="padding:6px 12px 6px 0;color:#78705e;font-size:13px;width:80px;vertical-align:top;">Event</td><td style="padding:6px 0;color:#3d2b1f;font-size:13px;font-weight:600;">${params.eventTitle}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0;color:#78705e;font-size:13px;vertical-align:top;">Date</td><td style="padding:6px 0;color:#3d2b1f;font-size:13px;">${params.eventDate}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0;color:#78705e;font-size:13px;vertical-align:top;">Location</td><td style="padding:6px 0;color:#3d2b1f;font-size:13px;">${params.eventLocation || "TBD"}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0;color:#78705e;font-size:13px;vertical-align:top;">Status</td><td style="padding:6px 0;">${statusBadge}</td></tr>`,
    '</table>',
    '</div>',
    calendarSection,
    '<hr style="border:none;border-top:1px solid #d4c4a0;margin:24px 0;">',
    '<p style="margin:0;font-size:12px;color:#9a8a6e;text-align:center;">',
    `<a href="${params.eventUrl}" style="color:#556b2f;">View event details</a> &middot; Sent by GameTaverns`,
    '</p>',
    '</div></div></div>',
    '</body></html>',
  ].join("");
}

function buildOrganizerEmail(params: {
  attendeeName: string;
  attendeeEmail: string;
  eventTitle: string;
  status: string;
  registrationCount: number;
  maxAttendees: number | null;
  eventUrl: string;
}): string {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#e8dcc8;font-family:Georgia,Times New Roman,serif;">',
    '<div style="max-width:560px;margin:0 auto;padding:24px;">',
    '<div style="background:#f5eed9;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(60,40,20,0.15);border:1px solid #d4c4a0;">',
    '<div style="background:#3d2b1f;padding:24px 32px;">',
    '<h1 style="margin:0;color:#e8d9b0;font-size:20px;font-family:Georgia,serif;">&#127922; New RSVP Received</h1>',
    '</div>',
    '<div style="padding:32px;">',
    `<p style="margin:0 0 16px;font-size:15px;color:#3d2b1f;"><strong>${params.attendeeName}</strong> (${params.attendeeEmail}) just ${params.status === "waitlisted" ? "joined the waitlist for" : "RSVP'd to"} your event.</p>`,
    '<div style="background:#efe5cf;border:1px solid #d4c4a0;border-radius:8px;padding:20px;margin:0 0 24px;">',
    '<table style="width:100%;border-collapse:collapse;">',
    `<tr><td style="padding:6px 12px 6px 0;color:#78705e;font-size:13px;width:100px;">Event</td><td style="padding:6px 0;color:#3d2b1f;font-size:13px;font-weight:600;">${params.eventTitle}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0;color:#78705e;font-size:13px;">Registrations</td><td style="padding:6px 0;color:#3d2b1f;font-size:13px;">${params.registrationCount}${params.maxAttendees ? ` / ${params.maxAttendees}` : ""}</td></tr>`,
    '</table>',
    '</div>',
    '<div style="text-align:center;">',
    `<a href="${params.eventUrl}" style="display:inline-block;background:#556b2f;color:#f5eed9;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">View Event</a>`,
    '</div>',
    '<hr style="border:none;border-top:1px solid #d4c4a0;margin:24px 0;">',
    '<p style="margin:0;font-size:12px;color:#9a8a6e;text-align:center;">Sent by GameTaverns</p>',
    '</div></div></div>',
    '</body></html>',
  ].join("");
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RsvpEmailRequest = await req.json();
    const { event_id, attendee_name, attendee_email, status, waitlist_position } = body;

    if (!event_id || !attendee_name || !attendee_email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch event + library details ──────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: event, error: eventErr } = await supabase
      .from("library_events")
      .select("id, title, description, event_date, event_location, library_id, max_attendees, venue_name, venue_address, end_date")
      .eq("id", event_id)
      .single();

    if (eventErr || !event) {
      console.error("Event not found:", eventErr);
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get library owner email for organizer notification
    const { data: library } = await supabase
      .from("libraries")
      .select("name, slug, owner_id")
      .eq("id", event.library_id)
      .single();

    let organizerEmail: string | null = null;
    if (library?.owner_id) {
      const { data: ownerProfile } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("user_id", library.owner_id)
        .single();
      
      if (!ownerProfile?.email) {
        // Fallback: get from auth.users
        const { data: authData } = await supabase.auth.admin.getUserById(library.owner_id);
        organizerEmail = authData?.user?.email || null;
      } else {
        organizerEmail = ownerProfile.email;
      }
    }

    // Get registration count
    const { count: regCount } = await supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event_id)
      .in("status", ["registered", "waitlisted"]);

    // ── Build calendar data ────────────────────────────────────────────
    const startDate = new Date(event.event_date);
    const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // default 3h
    const location = event.venue_name
      ? `${event.venue_name}${event.venue_address ? `, ${event.venue_address}` : ""}`
      : event.event_location || "";
    const eventDescription = event.description || `Join us for ${event.title} at GameTaverns!`;
    const siteUrl = Deno.env.get("SITE_URL") || "https://gametaverns.com";
    const eventUrl = `${siteUrl}/event/${event.id}`;

    const calendarData = {
      title: event.title,
      description: eventDescription,
      location,
      startDate,
      endDate,
      uid: `${event.id}@gametaverns.com`,
      organizerEmail: Deno.env.get("SMTP_FROM") || "events@gametaverns.com",
    };

    const icsContent = buildIcsContent(calendarData);
    const googleCalUrl = buildGoogleCalendarUrl(calendarData);

    // ── Format event date for display ──────────────────────────────────
    const dateStr = startDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // ── SMTP config ────────────────────────────────────────────────────
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPass = Deno.env.get("SMTP_PASS") || "";
    const smtpFrom = Deno.env.get("SMTP_FROM");

    if (!smtpHost || !smtpFrom) {
      console.error("Missing SMTP configuration");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isRelay = smtpPort === 25;
    const requiresAuth = !!(smtpUser && smtpPass) && !isRelay;
    const useTls = smtpPort === 465;

    const smtpConfig: Record<string, unknown> = {
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
    };

    // ── Send attendee confirmation ─────────────────────────────────────
    const attendeeHtml = buildAttendeeEmail({
      attendeeName: attendee_name,
      eventTitle: event.title,
      eventDate: dateStr,
      eventLocation: location,
      status,
      waitlistPosition: waitlist_position,
      googleCalUrl,
      eventUrl,
    });

    const attendeeSubject = status === "waitlisted"
      ? `Waitlisted: ${event.title}`
      : `You're confirmed: ${event.title} 🎲`;

    // Build .ics as base64 attachment
    const icsBase64 = btoa(icsContent);

    const client = new SMTPClient(smtpConfig);
    try {
      await withTimeout(
        client.send({
          from: smtpFrom,
          to: attendee_email,
          subject: attendeeSubject,
          html: attendeeHtml,
          attachments: status !== "waitlisted"
            ? [
                {
                  content: icsBase64,
                  encoding: "base64",
                  filename: "event.ics",
                  contentType: "text/calendar; method=REQUEST",
                },
              ]
            : undefined,
        }),
        SMTP_SEND_TIMEOUT_MS,
        "SMTP attendee email"
      );
      console.log(`RSVP confirmation sent to ${attendee_email}`);
    } catch (e) {
      console.error("Failed to send attendee email:", e);
    }

    // ── Send organizer notification ────────────────────────────────────
    if (organizerEmail) {
      const orgHtml = buildOrganizerEmail({
        attendeeName: attendee_name,
        attendeeEmail: attendee_email,
        eventTitle: event.title,
        status,
        registrationCount: regCount || 0,
        maxAttendees: event.max_attendees,
        eventUrl,
      });

      try {
        await withTimeout(
          client.send({
            from: smtpFrom,
            to: organizerEmail,
            subject: `New RSVP: ${attendee_name} → ${event.title}`,
            html: orgHtml,
          }),
          SMTP_SEND_TIMEOUT_MS,
          "SMTP organizer email"
        );
        console.log(`Organizer notification sent to ${organizerEmail}`);
      } catch (e) {
        console.error("Failed to send organizer email:", e);
      }
    }

    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-rsvp-confirmation error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
