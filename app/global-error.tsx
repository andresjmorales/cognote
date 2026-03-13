"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { BRAND_ICON_SIZE } from "@/lib/ui-constants";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf9f7",
          color: "#1a1a2e",
          fontFamily:
            '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <BrandMark
            size={BRAND_ICON_SIZE.panel}
            alt="CogNote"
            className="mb-6"
          />
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong 😕
          </h1>
          <p style={{ color: "#7a7872", marginBottom: "1.5rem" }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#2a9d8f",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
