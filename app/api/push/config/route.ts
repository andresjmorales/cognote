import { NextResponse } from "next/server";
import { clientVapidPublicKey } from "@/lib/server/push";

// Never prerendered: the value must come from the running process so a prebuilt
// image works with whatever keys the operator sets.
export const dynamic = "force-dynamic";

/** Only ever the PUBLIC half; the private key stays on the server. */
export async function GET() {
  return NextResponse.json({ publicKey: clientVapidPublicKey() });
}
