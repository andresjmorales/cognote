import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { displayName, avatarUrl } = body as {
    displayName?: unknown;
    avatarUrl?: unknown;
  };

  const patch: { display_name?: string; avatar_url?: string | null } = {};

  if (displayName !== undefined) {
    if (
      !displayName ||
      typeof displayName !== "string" ||
      !displayName.trim()
    ) {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 }
      );
    }
    patch.display_name = displayName.trim();
  }

  if (avatarUrl !== undefined) {
    if (avatarUrl !== null && typeof avatarUrl !== "string") {
      return NextResponse.json(
        { error: "Invalid avatar URL" },
        { status: 400 }
      );
    }
    if (typeof avatarUrl === "string") {
      // Only this teacher's own object in the public avatars bucket is
      // accepted; arbitrary URLs would be rendered as <img src> in the nav.
      const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
      if (avatarUrl.length > 2048 || !avatarUrl.startsWith(allowedPrefix)) {
        return NextResponse.json(
          { error: "Invalid avatar URL" },
          { status: 400 }
        );
      }
    }
    patch.avatar_url = avatarUrl;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("teachers")
    .update(patch)
    .eq("id", user.id);

  if (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
