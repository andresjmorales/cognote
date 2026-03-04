export default function TeacherLoading() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="flex flex-col items-center gap-3">
        <img
          src="/icon/cognote.svg"
          alt=""
          className="h-12 w-12 animate-pulse"
          width={48}
          height={48}
        />
        <span className="text-sm text-muted animate-pulse font-[family-name:var(--font-nunito)]">
          Loading&hellip;
        </span>
      </div>
    </div>
  );
}
