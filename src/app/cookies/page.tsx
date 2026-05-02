import type { Metadata } from "next";
import { MarketingPublicHeader } from "@/components/MarketingPublicHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cookies — PSTUDY",
  description:
    "How PSTUDY uses essential first-party cookies for authentication. No analytics or marketing cookies.",
};

function LastUpdated() {
  const d = new Date();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <MarketingPublicHeader />

      <main className="mx-auto max-w-3xl px-4 py-12 pb-20">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Cookies</h1>
        <p className="mt-2 text-sm text-stone-500">Last updated: {LastUpdated()}</p>

        <article className="mt-10 space-y-8 text-base leading-relaxed text-stone-700">
          <section className="space-y-4">
            <p>
              PSTUDY uses{" "}
              <strong className="font-medium text-stone-800">only essential first-party cookies</strong>{" "}
              that are strictly necessary for the service to work: signing you in, keeping your
              session in sync between your browser and our servers, and completing secure
              authentication flows. We do{" "}
              <strong className="font-medium text-stone-800">not</strong> use analytics cookies,
              advertising cookies, or third-party marketing trackers.
            </p>
            <p>
              Because every cookie we set falls into the “strictly necessary” category for an online
              service with accounts,{" "}
              <strong className="font-medium text-stone-800">
                we do not show a consent banner with accept or reject toggles
              </strong>{" "}
              for cookies under the ePrivacy rules as implemented for essential services. You can
              still control or delete cookies through your browser settings; if you block essential
              cookies, parts of PSTUDY (including sign-in) may not function.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Cookies set by PSTUDY</h2>
            <p>
              PSTUDY relies on the official Supabase client libraries for Next.js. Those libraries
              store your authenticated session in{" "}
              <strong className="font-medium text-stone-800">first-party HTTP cookies</strong> on
              our domain. The exact cookie names include a reference to your Supabase project (for
              example, names beginning with{" "}
              <code className="rounded bg-stone-200 px-1.5 py-0.5 text-sm text-stone-800">sb-</code>{" "}
              followed by your project identifier and{" "}
              <code className="rounded bg-stone-200 px-1.5 py-0.5 text-sm text-stone-800">
                -auth-token
              </code>
              ). When the session payload is large, Supabase may split it into numbered fragments such
              as <code className="rounded bg-stone-200 px-1.5 py-0.5 text-sm text-stone-800">.0</code>
              , <code className="rounded bg-stone-200 px-1.5 py-0.5 text-sm text-stone-800">.1</code>
              , and so on. All of these are still first-party cookies set by PSTUDY’s application
              code through Supabase.
            </p>
            <p>
              <strong className="font-medium text-stone-800">Purpose.</strong> These cookies let you
              stay logged in, refresh your session securely, and call authenticated APIs from the
              browser and from server components.
            </p>
            <p>
              <strong className="font-medium text-stone-800">Duration.</strong> They are{" "}
              <strong className="font-medium text-stone-800">persistent</strong> cookies with an
              expiry chosen by Supabase (typically on the order of months for the refresh component),
              and they are refreshed while you use the product or until you sign out. When you sign
              out, Supabase clears or invalidates the session cookies.
            </p>
            <p>
              <strong className="font-medium text-stone-800">Short-lived cookies during sign-in.</strong>{" "}
              When you use email links, invitations, or certain OAuth-style flows, Supabase may
              briefly set additional first-party cookies (for example to complete PKCE or code
              exchange). They exist only for the authentication step and are cleared once your session
              is established.
            </p>
            <p>
              <strong className="font-medium text-stone-800">Next.js session cookie.</strong> The
              PSTUDY codebase does not set a separate, general-purpose “Next.js session” cookie
              beyond what Supabase uses for authentication. Server-side rendering reads the same
              Supabase session cookies through Next.js APIs.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Other storage</h2>
            <p>
              PSTUDY also stores some{" "}
              <strong className="font-medium text-stone-800">non-essential UI preferences</strong> in
              your browser’s <strong className="font-medium text-stone-800">local storage</strong>{" "}
              (for example the interface language key{" "}
              <code className="rounded bg-stone-200 px-1.5 py-0.5 text-sm text-stone-800">
                pstudy-locale
              </code>
              , practice display options, or deck editor column visibility). Local storage is{" "}
              <strong className="font-medium text-stone-800">not</strong> the same as a cookie: it
              is not sent automatically with every HTTP request and is not used for advertising.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">More detail</h2>
            <p>
              For how personal data is processed, including processors and your GDPR rights, see
              the{" "}
              <a href="/privacy" className="text-pstudy-primary underline hover:no-underline">
                Privacy Policy
              </a>
              .
            </p>
            <p>
              Our hosting provider Vercel may set technical cookies for security and infrastructure
              purposes (such as DDoS protection and edge routing). These are managed by Vercel and
              described in their cookie policy.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
