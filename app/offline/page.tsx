export const metadata = { title: "Offline" };

/** Deliberately self-contained: inline styles only, no Tailwind classes and no
 *  client JS, so it renders correctly from cache on a cold first offline load. */
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
      <a href="/" style={{ fontSize: "0.875rem", color: "#2a9d8f" }}>
        Retry
      </a>
    </main>
  );
}
