import type { NextRequest } from "next/server";
import { requestOrigin } from "@/lib/server/http";
import { secureCompare } from "@/lib/server/secure-compare";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  return secureCompare(header, `Bearer ${secret}`);
}

/** Absolute origin for links in emails the cron sends. */
export function cronOrigin(req: NextRequest): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  return requestOrigin(req);
}
