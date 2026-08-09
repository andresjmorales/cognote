import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { formatEventWhen } from "@/lib/events";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RsvpStatus } from "@/lib/supabase/types";

export const metadata = { title: "Events" };

interface EventListRow {
  id: string;
  title: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  event_students: { id: string }[] | null;
  event_rsvps: { status: RsvpStatus }[] | null;
}

type EventRow = ReturnType<typeof buildEventRows>[number];

function buildEventRows(events: EventListRow[], timezone: string) {
  const now = Date.now();
  return events.map((event) => {
    const rsvps = event.event_rsvps ?? [];
    return {
      id: event.id,
      title: event.title,
      location: event.location,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      when: formatEventWhen(event.starts_at, event.ends_at, timezone),
      studentCount: event.event_students?.length ?? 0,
      rsvpYes: rsvps.filter((r) => r.status === "yes").length,
      rsvpPending: rsvps.filter((r) => r.status === "pending").length,
      isUpcoming: new Date(event.starts_at).getTime() >= now,
    };
  });
}

function EventList({ items, empty }: { items: EventRow[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted py-2">{empty}</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((event) => (
        <Link key={event.id} href={`/events/${event.id}`} className="block">
          <Card padding="sm" className="hover:border-primary/40 transition-colors">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{event.title}</div>
                <div className="text-sm text-muted mt-0.5">{event.when}</div>
                {event.location?.trim() ? (
                  <div className="text-sm text-muted mt-0.5">
                    {event.location}
                  </div>
                ) : null}
              </div>
              <div className="text-sm text-muted text-right shrink-0">
                <div>
                  {event.studentCount}{" "}
                  {event.studentCount === 1 ? "performer" : "performers"}
                </div>
                <div className="mt-0.5">
                  RSVP: {event.rsvpYes} yes · {event.rsvpPending} pending
                </div>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const policy = await getPolicy(supabase, user.id);
  const { data: events } = await supabase
    .from("events")
    .select(
      `
      id, title, location, starts_at, ends_at,
      event_students ( id ),
      event_rsvps ( status )
    `
    )
    .eq("teacher_id", user.id)
    .order("starts_at", { ascending: false });

  const rows = buildEventRows(
    (events ?? []) as unknown as EventListRow[],
    policy.timezone
  );

  const upcoming = rows.filter((r) => r.isUpcoming).reverse();
  const past = rows.filter((r) => !r.isUpcoming);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted text-sm mt-1">
            Recitals and studio events. Invite performers and track family RSVPs.
          </p>
        </div>
        <Link href="/events/new">
          <Button>Create Event</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card className="text-center text-muted">
          No events yet. Create a recital to invite students and collect RSVPs.
        </Card>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">
              Upcoming
            </h2>
            <EventList items={upcoming} empty="No upcoming events." />
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">
              Past
            </h2>
            <EventList items={past} empty="No past events." />
          </section>
        </div>
      )}
    </div>
  );
}
