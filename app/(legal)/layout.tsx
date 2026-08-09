import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { getDeploymentMode } from "@/lib/entitlements";
import { BRAND_ICON_SIZE } from "@/lib/ui-constants";

/**
 * Legal pages exist only on the official hosted instance; a self-hosted
 * deployment is its own data controller and needs its own terms.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (getDeploymentMode() !== "hosted") notFound();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-surface shrink-0">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-primary tracking-tight"
          >
            <BrandMark size={BRAND_ICON_SIZE.header} className="h-8 w-8" />
            CogNote
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        {children}
      </main>
      <footer className="border-t border-border py-4 shrink-0">
        <div className="flex items-center justify-center gap-4 text-sm text-muted">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
