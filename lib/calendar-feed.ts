import { createEvents, type EventAttributes } from "ics";
import { NextResponse } from "next/server";

/**
 * Shared .ics assembly for the calendar feeds (family portal + teacher
 * schedule). The pure builders live here so they can be unit-tested: vitest
 * only runs lib/**\/*.test.ts in a plain Node environment.
 */

export interface FeedLesson {
  id: string;
  starts_at: string;
  duration_minutes: number;
  studentName: string;
}

export interface FeedEvent {
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
}

/** The five-part UTC breakdown the `ics` package expects for a utc start. */
function utcParts(iso: string): [number, number, number, number, number] {
  const d = new Date(iso);
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}

/** One lesson -> one event. UID is stable per lesson id so clients update. */
export function lessonEvent(l: FeedLesson, calName: string): EventAttributes {
  return {
    uid: `${l.id}@cognote.studio`,
    start: utcParts(l.starts_at),
    startInputType: "utc",
    startOutputType: "utc",
    duration: { minutes: l.duration_minutes },
    title: `Piano lesson — ${l.studentName}`,
    calName,
  };
}

/** One studio event (recital). UID is stable per event id. */
export function studioEvent(e: FeedEvent, calName: string): EventAttributes {
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : null;
  const minutes =
    end && end > start ? Math.round((end.getTime() - start.getTime()) / 60000) : 60;
  return {
    uid: `${e.id}@cognote.studio`,
    start: utcParts(e.starts_at),
    startInputType: "utc",
    startOutputType: "utc",
    duration: { minutes },
    title: e.title,
    location: e.location || undefined,
    calName,
  };
}

const EMPTY_CALENDAR =
  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//CogNote Studio//EN\r\nEND:VCALENDAR\r\n";

/** ICS text for the events, or null when `ics` reports a generation error. */
export function buildIcs(events: EventAttributes[]): string | null {
  if (events.length === 0) return EMPTY_CALENDAR;
  const { value, error } = createEvents(events);
  if (error || !value) return null;
  return value;
}

/** `lessons-the-lee-family.ics` — owner name slugified for the download. */
export function icsFilename(name: string, prefix = "lessons"): string {
  return `${prefix}-${name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.ics`;
}

export function icsResponse(events: EventAttributes[], filename: string): NextResponse {
  const body = buildIcs(events);
  if (body === null) {
    return NextResponse.json({ error: "Calendar generation failed" }, { status: 500 });
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
    },
  });
}
