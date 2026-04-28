"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

/** Header / toolbar link to the Help page — same label and style app-wide. */
export function HelpNavLink({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Link
      href="/help"
      className={`text-stone-600 hover:text-pstudy-primary ${className}`.trim()}
    >
      {t("help.nav")}
    </Link>
  );
}
