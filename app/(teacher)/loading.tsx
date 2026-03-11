export default function TeacherLoading() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="flex flex-col items-center gap-3">
        <img
          src="/icon/cognote.svg"
          alt=""
          className="h-16 w-16 animate-pulse"
          width={64}
          height={64}
        />
        <span className="text-base text-muted animate-pulse font-[family-name:var(--font-nunito)]">
          Loading&hellip;
        </span>
      </div>
    </div>
  );
}
