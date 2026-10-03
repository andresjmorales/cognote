"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { releasePushIfOwnedByOther } from "@/lib/push-client";

/**
 * Release this browser's push subscription when it belongs to a different
 * teacher than the one now signed in.
 *
 * Mounted in the teacher layout rather than in an individual form so that
 * EVERY path that establishes a teacher session runs it: password sign-in and
 * signup (LoginForm), and the email-confirm / password-reset links handled by
 * the server-side `/auth/confirm` route. That route cannot do this itself — the
 * release touches localStorage and the service worker, which only exist in the
 * browser — so the authenticated page it redirects to performs it instead.
 *
 * No session means no-op: there is nothing to attribute the subscription to.
 */
export function PushOwnership() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      const userId = session?.user.id;
      if (!cancelled && userId) await releasePushIfOwnedByOther(userId);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
