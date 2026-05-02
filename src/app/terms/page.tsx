import type { Metadata } from "next";
import { MarketingPublicHeader } from "@/components/MarketingPublicHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service — PSTUDY",
  description: "Terms governing your use of the PSTUDY study platform operated by Tesco Engineering BV.",
};

function LastUpdated() {
  const d = new Date();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <MarketingPublicHeader />

      <main className="mx-auto max-w-3xl px-4 py-12 pb-20">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-stone-500">Last updated: {LastUpdated()}</p>

        <article className="mt-10 space-y-10 text-base leading-relaxed text-stone-700">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Who we are</h2>
            <p>
              These terms are between you and{" "}
              <strong className="font-medium text-stone-800">Tesco Engineering BV</strong>,
              Heibergstraat 6, 2235 Hulshout, Belgium (VAT:{" "}
              <strong className="font-medium text-stone-800">BE 0477 579 104</strong>). We operate
              the PSTUDY online service. If you have questions about these terms, you can write to{" "}
              <a
                href="mailto:privacy@pstudy.be"
                className="text-pstudy-primary underline hover:no-underline"
              >
                privacy@pstudy.be
              </a>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">What PSTUDY is</h2>
            <p>
              PSTUDY is a browser-based study platform for flashcards, practice modes, timed exams,
              and sharing decks with others (including optional community features such as
              PstudyCommunity). Features may evolve over time; the core idea is to help you learn and
              teach more effectively without installing native software.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Account creation and beta status</h2>
            <p>
              PSTUDY is currently in a <strong className="font-medium text-stone-800">private beta</strong>
              . During the beta the service is{" "}
              <strong className="font-medium text-stone-800">free to use</strong> and access is{" "}
              <strong className="font-medium text-stone-800">capped at fifty (50) users</strong>. We
              expect to introduce paid plans in Q3 2026 (July–September). When we do, beta users will
              receive at least six months free, then a locked-in price of €3.99 per month (or €35
              per year) for as long as their subscription stays active, and we will give at least{" "}
              <strong className="font-medium text-stone-800">thirty (30) days notice</strong> before
              any material change to pricing or to the relationship between you and PSTUDY. Your
              decks remain exportable at any time, as described in our product materials and privacy
              policy.
            </p>
            <p>
              We may adjust non-pricing aspects of the beta (for example limits, feature flags, or
              abuse-prevention measures) where needed to keep the service fair and stable. If a
              change meaningfully affects your rights, we will use the notice approach described in
              the “Changes to these terms” section below.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Acceptable use</h2>
            <p>
              You agree to use PSTUDY responsibly. You must not use the service for anything
              unlawful, to harass or harm others, or to upload or share illegal content. You must not
              upload deck material that infringes someone else’s copyright or other intellectual
              property unless you have the rights or permissions needed to share it. You must not
              misuse AI generation—for example by attempting to generate content that is unrelated to
              genuine learning or teaching, or by trying to bypass technical limits, rate limits,
              or security controls. We may suspend or throttle accounts that put the service or other
              users at risk.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Your content</h2>
            <p>
              You retain ownership of the decks and other original content you create in PSTUDY,
              subject to the rights you grant us in this agreement so that we can host and display
              your material. When you choose to share a deck publicly to{" "}
              <strong className="font-medium text-stone-800">PstudyCommunity</strong>, you grant
              other PSTUDY users a licence to view that deck, copy it into their own workspace for
              personal study, and use it in line with the community features we provide. You remain
              responsible for ensuring you have the rights to anything you publish.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">PSTUDY’s intellectual property</h2>
            <p>
              The PSTUDY name, logo, user interface, and underlying software are owned by Tesco
              Engineering BV or our licensors. These terms do not grant you any rights to our
              trademarks or source code except the limited right to use the hosted service in your
              browser in line with your account type.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">AI-generated content</h2>
            <p>
              Some features use artificial intelligence to suggest or generate study material. AI
              output can be wrong, incomplete, or unsuitable for your context. You should always
              review and verify AI-generated content before relying on it for real studies, teaching,
              or assessments. We do not guarantee accuracy or fitness for a particular purpose for
              AI-generated output.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Account suspension and deletion</h2>
            <p>
              We may suspend or terminate accounts that seriously or repeatedly break these terms, or
              where we must do so to comply with law or protect security. You may stop using PSTUDY
              at any time; where the product offers account deletion, you may use that flow, or you can
              contact us at{" "}
              <a
                href="mailto:privacy@pstudy.be"
                className="text-pstudy-primary underline hover:no-underline"
              >
                privacy@pstudy.be
              </a>{" "}
              for help. Our privacy policy explains what happens to personal data when an account is
              deleted.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Liability</h2>
            <p>
              PSTUDY is provided on an <strong className="font-medium text-stone-800">“as is”</strong>{" "}
              and <strong className="font-medium text-stone-800">“as available”</strong> basis. To
              the fullest extent permitted by Belgian law, Tesco Engineering BV is not liable for
              indirect or consequential damages (including lost profits, lost data, or business
              interruption) arising from your use of the service.
            </p>
            <p>
              Our total aggregate liability for any claim arising out of or relating to PSTUDY is
              limited to the amount you paid us for PSTUDY in the twelve months before the event
              giving rise to liability. During the private beta,{" "}
              <strong className="font-medium text-stone-800">that amount is €0</strong>, so our
              aggregate liability is correspondingly capped, except where Belgian law does not allow
              such a limitation (for example in cases of fraud or wilful misconduct).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Governing law and jurisdiction</h2>
            <p>
              These terms are governed by the{" "}
              <strong className="font-medium text-stone-800">laws of Belgium</strong>, without regard
              to conflict-of-law rules. The courts of{" "}
              <strong className="font-medium text-stone-800">Antwerp</strong> have exclusive
              jurisdiction for disputes, except where mandatory consumer protections give you the
              right to bring a claim in another EU court of your residence.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Contact</h2>
            <p>
              For anything related to these terms (including questions before you sign up), contact
              us at{" "}
              <a
                href="mailto:privacy@pstudy.be"
                className="text-pstudy-primary underline hover:no-underline"
              >
                privacy@pstudy.be
              </a>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Changes to these terms</h2>
            <p>
              We may update these terms as PSTUDY grows. When we make a{" "}
              <strong className="font-medium text-stone-800">material</strong> change—especially one
              that affects your legal rights—we will notify you in a clear way, such as by email or
              an in-app notice, and where the law requires it we will give at least{" "}
              <strong className="font-medium text-stone-800">thirty (30) days advance notice</strong>{" "}
              before the change takes effect. Continued use after the effective date may constitute
              acceptance of the updated terms where permitted by law; if you do not agree, you should
              stop using PSTUDY and export your decks before the change applies.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
