import { runtimeConfigScript, serverPublicConfig } from "@/lib/runtime-config";

// Read per request: the whole point is that the values come from the running
// container's environment, not from the build.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(runtimeConfigScript(serverPublicConfig()), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Browsers revalidate every load; a CDN may hold it briefly. The values
      // only change on a redeploy or container restart.
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
