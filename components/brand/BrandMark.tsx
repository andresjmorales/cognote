import Image from "next/image";
import { BRAND_ICON_SRC } from "@/lib/ui-constants";

type BrandMarkProps = {
  size: number;
  alt?: string;
  className?: string;
};

export function BrandMark({
  size,
  alt = "",
  className,
}: BrandMarkProps) {
  return (
    <Image
      src={BRAND_ICON_SRC}
      alt={alt}
      width={size}
      height={size}
      className={className}
    />
  );
}
