"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Logo } from "@/components/Logo";

type AppHeaderProps = {
  nav?: ReactNode;
  children?: ReactNode;
  maxWidthClassName?: string;
  logoLinkToHome?: boolean;
};

export function AppHeader({
  nav,
  children,
  maxWidthClassName = "max-w-4xl",
  logoLinkToHome = true,
}: AppHeaderProps) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div
        className={`mx-auto flex ${maxWidthClassName} flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-4`}
      >
        <div className="shrink-0">
          <Logo size="sm" withText linkToHome={logoLinkToHome} />
        </div>
        {nav ? (
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:justify-end">
            {nav}
          </nav>
        ) : null}
      </div>
      {children ? (
        <div className={`mx-auto ${maxWidthClassName} px-4 pb-4`}>
          {children}
        </div>
      ) : null}
    </header>
  );
}

export function AppHeaderLink({
  href,
  children,
  className = "",
  active = false,
  ariaCurrent = "page",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  active?: boolean;
  ariaCurrent?: "page" | "true" | "false";
}) {
  const base = active ? "font-medium text-pstudy-primary" : "text-stone-600 hover:text-pstudy-primary";
  return (
    <Link href={href} className={`${base} ${className}`.trim()} aria-current={active ? ariaCurrent : undefined}>
      {children}
    </Link>
  );
}
