"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.notifications ?? []);
    setUnread(data.unreadCount ?? 0);
  }

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    void load();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    void load();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        className="relative p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-dim cursor-pointer"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-muted px-3 py-6 text-center">
                No notifications yet.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`w-full text-left px-3 py-2.5 border-b border-border last:border-0 hover:bg-surface-dim cursor-pointer ${
                    n.read_at ? "" : "bg-primary/5"
                  }`}
                  onClick={() => {
                    void markRead(n.id);
                    setOpen(false);
                    if (n.href) {
                      router.push(n.href);
                    }
                  }}
                >
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && (
                    <div className="text-xs text-muted mt-0.5 whitespace-pre-wrap line-clamp-3">
                      {n.body}
                    </div>
                  )}
                  <div className="text-[10px] text-muted mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="px-3 py-2 border-t border-border text-[11px] text-muted">
            Email alerts are controlled in{" "}
            <Link
              href="/settings"
              className="text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>
            .
          </div>
        </div>
      )}
    </div>
  );
}
