"use client";

import Link from "next/link";

type LogoProps = {
  /** Size: "sm" for headers, "md" for hero/login */
  size?: "sm" | "md";
  /** Include text "PSTUDY" next to logo (useful if logo is icon-only) */
  withText?: boolean;
  /** Wrap in link to home */
  linkToHome?: boolean;
  className?: string;
};

export function Logo({ size = "sm", withText = false, linkToHome = true, className = "" }: LogoProps) {
  const heightClass = size === "sm" ? "h-9" : "h-12";
  const content = (
    <>
      <img
        src="/logo.jpg"
        alt="PSTUDY"
        className={`max-w-[180px] object-contain object-left ${heightClass}`}
        style={{
          filter: "sepia(1) saturate(6) hue-rotate(145deg) brightness(0.9) contrast(1.1)",
        }}
      />
      {withText && (
        <span
          className={`font-bold text-pstudy-primary ${
            size === "sm" ? "text-xl" : "text-2xl"
          }`}
        >
          PSTUDY
        </span>
      )}
    </>
  );

  const wrapperClass = `flex items-center gap-2 ${className}`;

  if (linkToHome) {
    return (
      <Link href="/" className={`${wrapperClass} hover:opacity-90 transition-opacity`}>
        {content}
      </Link>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}
