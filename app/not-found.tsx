import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { BRAND_ICON_SIZE } from "@/lib/ui-constants";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <BrandMark
          size={BRAND_ICON_SIZE.panel}
          alt="CogNote"
          className="mx-auto mb-6"
        />
        <h1 className="text-2xl font-bold mb-2">Page not found 😕</h1>
        <p className="text-muted mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block bg-primary text-white rounded-lg px-6 py-2.5 text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
