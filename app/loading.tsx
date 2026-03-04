export default function RootLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <img
        src="/icon/cognote.svg"
        alt="CogNote"
        className="h-16 w-16 animate-pulse"
        width={64}
        height={64}
      />
      <div className="text-sm text-muted animate-pulse font-[family-name:var(--font-nunito)]">
        Loading&hellip;
      </div>
    </div>
  );
}
