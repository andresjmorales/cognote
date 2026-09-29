import Link from "next/link";

export const metadata = { title: "Offline" };

/** Deliberately self-contained: inline styles only, no Tailwind classes, so it
 *  renders correctly from cache on a cold first offline load. next/link emits a
 *  plain anchor in SSR HTML, so the page is readable without hydration. */
export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "0 1.5rem",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
        background: "#faf9f7",
        color: "#1a1a2e",
      }}
    >
      <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
        You&rsquo;re offline
      </h1>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", maxWidth: "24rem", margin: 0 }}>
        CogNote needs a connection to load your studio. Reconnect and try again.
      </p>
      <Link href="/" style={{ fontSize: "0.875rem", color: "#2a9d8f" }}>
        Retry
      </Link>
    </main>
  );
}
