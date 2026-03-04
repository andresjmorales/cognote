import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <img
          src="/icon/cognote.svg"
          alt="CogNote"
          width={64}
          height={64}
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
