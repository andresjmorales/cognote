import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { suggestMappingWithAi } from "@/lib/ai/provider";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const policy = await getPolicy(supabase, user.id);
  if (policy.ai_provider === "none" || !policy.ai_api_key) {
    return NextResponse.json(
      {
        error:
          "Optional AI is not configured. Add a provider and key under Settings → Optional AI, or map columns manually.",
      },
      { status: 400 }
    );
  }

  const body = (await req.json()) as {
    headers?: string[];
    sampleRows?: Record<string, string>[];
  };

  if (!Array.isArray(body.headers) || body.headers.length === 0) {
    return NextResponse.json({ error: "headers required" }, { status: 400 });
  }

  const result = await suggestMappingWithAi({
    provider: policy.ai_provider,
    apiKey: policy.ai_api_key,
    headers: body.headers,
    sampleRows: Array.isArray(body.sampleRows) ? body.sampleRows : [],
  });

  if (result.error && Object.keys(result.mapping).length === 0) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    mapping: result.mapping,
    warning: result.error,
  });
}
