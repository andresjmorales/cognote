import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  creditPackageUpdateSchema,
  parseBody,
} from "@/lib/server/api-schemas";
import { oneToOne } from "@/lib/schedule";

/**
 * Change a package's expiry date (the only editable field).
 * Body: { expiresOn: "YYYY-MM-DD" | "" | null } — empty clears it.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseBody(
    creditPackageUpdateSchema,
    await req.json().catch(() => null)
  );
  if (!parsed.ok) return parsed.response;
  const expiresOn = parsed.data.expiresOn || null;

  const { data: existing } = await supabase
    .from("credit_packages")
    .select("id, starts_on, credit_redemptions ( lessons ( lesson_date ) )")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (expiresOn && expiresOn < existing.starts_on) {
    return NextResponse.json(
      { error: "Expiry must be on or after the start date" },
      { status: 400 }
    );
  }
  // Credits already used stay valid; don't move the expiry before them.
  const usedDates = (
    (existing.credit_redemptions ?? []) as {
      lessons: { lesson_date: string } | { lesson_date: string }[] | null;
    }[]
  ).flatMap((r) => oneToOne(r.lessons)?.lesson_date ?? []);
  const lastUsed = usedDates.sort().at(-1);
  if (expiresOn && lastUsed && expiresOn < lastUsed) {
    return NextResponse.json(
      { error: `A credit was already used for a lesson on ${lastUsed}` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("credit_packages")
    .update({ expires_on: expiresOn })
    .eq("id", id)
    .eq("teacher_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
