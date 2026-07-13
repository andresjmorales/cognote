import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewEventForm } from "@/components/teacher/events/NewEventForm";

export const metadata = { title: "New Event" };

function defaultStartsAt(dateParam?: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return `${dateParam}T15:00`;
  }
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: students } = await supabase
    .from("students")
    .select("id, name")
    .eq("teacher_id", user.id)
    .order("name");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/events"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          ← Events
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create Event</h1>
        <p className="text-muted text-sm mt-1">
          Set the date, invite performers, and families will get pending RSVPs.
        </p>
      </div>
      <NewEventForm
        students={students ?? []}
        initialStartsAt={defaultStartsAt(params.date)}
      />
    </div>
  );
}
