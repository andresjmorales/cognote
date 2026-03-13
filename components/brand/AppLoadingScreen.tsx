import { BrandMark } from "@/components/brand/BrandMark";
import { BRAND_ICON_SIZE, LOADING_COPY } from "@/lib/ui-constants";

type AppLoadingScreenProps = {
  message?: string;
  className?: string;
};

export function AppLoadingScreen({
  message = LOADING_COPY.default,
  className = "min-h-screen bg-background",
}: AppLoadingScreenProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 font-[family-name:var(--font-nunito)] ${className}`}
    >
      <BrandMark
        size={BRAND_ICON_SIZE.loading}
        alt="CogNote"
        className="h-24 w-24 animate-pulse"
      />
      <div className="text-base text-muted animate-pulse">{message}</div>
    </div>
  );
}
