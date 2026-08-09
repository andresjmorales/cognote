import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { TouchHoverGuard } from "@/components/ui/touch-hover-guard";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CogNote",
    template: "CogNote - %s",
  },
  description:
    "Open-source studio management for private music teachers: scheduling, attendance, family portals, and progress tracking, with quizzes, flashcards, and spaced repetition built in",
  icons: {
    icon: "/icon/cognote.svg",
    apple: "/icon/cognote.svg",
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
        <TouchHoverGuard />
        <ToastProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
