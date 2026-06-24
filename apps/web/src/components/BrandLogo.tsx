import Image from "next/image";
import Link from "next/link";

export function BrandLogo({
  href = "/",
  size = "md",
  showWordmark = false,
  className = "",
}: {
  href?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  showWordmark?: boolean;
  className?: string;
}) {
  const heights = { xs: 24, sm: 72, md: 100, lg: 132, xl: 160, "2xl": 192 };
  const h = heights[size];

  const inner = (
    <>
      <Image
        src="/logo.png"
        alt="DocSolid"
        width={Math.round(h * 1.15)}
        height={h}
        className="brand-logo-img"
        priority
      />
      {showWordmark && (
        <span className="brand-wordmark" aria-hidden={!showWordmark}>
          <span className="brand-wordmark-doc">Doc</span>
          <span className="brand-wordmark-solid">Solid</span>
        </span>
      )}
    </>
  );

  const cls = `brand-logo brand-logo-${size} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }

  return <span className={cls}>{inner}</span>;
}
