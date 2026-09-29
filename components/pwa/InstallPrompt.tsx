"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    // Deferred a tick: repo lint bans synchronous setState in an effect body.
    // (setDeferred below is fine — it runs inside an event handler, not the body.)
    const id = setTimeout(() => {
      const nav = window.navigator as Navigator & { standalone?: boolean };
      const isIos = /iphone|ipad|ipod/i.test(nav.userAgent);
      const installed =
        window.matchMedia("(display-mode: standalone)").matches ||
        nav.standalone === true;
      setShowIos(isIos && !installed);
    }, 0);

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      clearTimeout(id);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (showIos) {
    return (
      <p className="text-xs text-muted">
        Install CogNote: tap Share, then <strong>Add to Home Screen</strong>.
      </p>
    );
  }
  if (!deferred) return null;

  return (
    <button
      type="button"
      className="text-xs text-primary hover:underline cursor-pointer"
      onClick={() => {
        void deferred.prompt();
        setDeferred(null);
      }}
    >
      Install CogNote
    </button>
  );
}
