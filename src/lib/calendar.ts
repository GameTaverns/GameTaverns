/**
 * Calendar utilities — iCal (.ics) generation and Google Calendar link builder
 */

/** Escape special characters for iCal format */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Format Date to iCal DTSTART value (date-only or datetime) */
function toIcsDate(date: Date, allDay = false): string {
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
  }
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  url?: string;
}

/**
 * Generate a .ics file content string
 */
export function generateICS(event: CalendarEvent): string {
  const start = toIcsDate(event.startDate, event.allDay);
  const end = event.endDate
    ? toIcsDate(event.endDate, event.allDay)
    : event.allDay
    ? toIcsDate(new Date(event.startDate.getTime() + 86400000), true)
    : toIcsDate(new Date(event.startDate.getTime() + 2 * 3600000)); // default 2h

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GameTaverns//Game Night//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART${event.allDay ? ";VALUE=DATE" : ""}:${start}`,
    `DTEND${event.allDay ? ";VALUE=DATE" : ""}:${end}`,
    `SUMMARY:${icsEscape(event.title)}`,
  ];

  if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
  if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push(`UID:${crypto.randomUUID()}@gametaverns.com`);
  lines.push(`DTSTAMP:${toIcsDate(new Date())}`);
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Download an .ics file
 */
export function downloadICS(event: CalendarEvent): void {
  const content = generateICS(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9]+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build a Google Calendar "add event" URL
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const start = toIcsDate(event.startDate, event.allDay);
  const end = event.endDate
    ? toIcsDate(event.endDate, event.allDay)
    : event.allDay
    ? toIcsDate(new Date(event.startDate.getTime() + 86400000), true)
    : toIcsDate(new Date(event.startDate.getTime() + 2 * 3600000));

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
  });

  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
