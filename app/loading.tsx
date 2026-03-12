export default function RootLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <img
        src="/icon/cognote.svg"
        alt="CogNote"
        className="h-24 w-24 animate-pulse"
        width={96}
        height={96}
      />
      <div className="text-base text-muted animate-pulse font-[family-name:var(--font-nunito)]">
        Loading&hellip;
      </div>
    </div>
  );
}
