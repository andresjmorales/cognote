import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Nunito } from "next/font/google";
import { PWA } from "@/lib/pwa";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { TouchHoverGuard } from "@/components/ui/touch-hover-guard";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { RUNTIME_CONFIG_PATH } from "@/lib/runtime-config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: PWA.themeColor,
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "CogNote",
    template: "CogNote - %s",
  },
  description:
    "Open-source studio management for private music teachers: scheduling, attendance, family portals, and progress tracking, with quizzes, flashcards, and spaced repetition built in",
  appleWebApp: { capable: true, statusBarStyle: "default", title: PWA.shortName },
  icons: {
    icon: "/icon/cognote.svg",
    apple: "/icons/apple-touch-icon.png", // PNG — iOS ignores SVG here
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="can-hover">
      <body className={`${inter.variable} ${nunito.variable} antialiased`}>
        {/* Supabase URL + anon key from the running server's env, set before
            hydration so a prebuilt image works against any Supabase. Loaded as
            a file (not inlined) so static pages stay static. See lib/runtime-config. */}
        <Script src={RUNTIME_CONFIG_PATH} strategy="beforeInteractive" />
        <ServiceWorkerRegistrar />
        <TouchHoverGuard />
        <ToastProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
