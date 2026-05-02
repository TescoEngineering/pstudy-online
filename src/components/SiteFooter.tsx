import Link from "next/link";

/**
 * Global footer: legal + contact links on every page (marketing and authenticated).
 * Link labels are English-only for LEG-01 consistency with legal pages.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 bg-stone-50 py-8">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 text-sm text-stone-600">
        <Link href="/pricing" className="hover:underline">
          Pricing
        </Link>
        <Link href="/for-schools" className="hover:underline">
          For Schools
        </Link>
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="hover:underline">
          Terms
        </Link>
        <Link href="/cookies" className="hover:underline">
          Cookies
        </Link>
        <Link href="/privacy" className="hover:underline">
          GDPR
        </Link>
        <a href="mailto:hello@pstudy.be" className="hover:underline">
          Contact
        </a>
        <Link href="/help" className="hover:underline">
          Help
        </Link>
      </div>
      <div className="mt-4 text-center text-xs text-stone-500">
        PSTUDY ·{" "}
        <a
          href="https://www.pstudy.be"
          target="_blank"
          rel="noopener noreferrer"
          className="text-pstudy-primary hover:underline"
        >
          www.pstudy.be
        </a>
      </div>
    </footer>
  );
}
