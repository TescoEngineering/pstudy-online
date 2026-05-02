import type { Metadata } from "next";
import { MarketingPublicHeader } from "@/components/MarketingPublicHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy — PSTUDY",
  description:
    "How Tesco Engineering BV collects, uses, and protects personal data when you use PSTUDY.",
};

function LastUpdated() {
  const d = new Date();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <MarketingPublicHeader />

      <main className="mx-auto max-w-3xl px-4 py-12 pb-20">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-stone-500">Last updated: {LastUpdated()}</p>

        <article className="mt-10 space-y-10 text-base leading-relaxed text-stone-700">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Who we are</h2>
            <p>
              PSTUDY is operated by{" "}
              <strong className="font-medium text-stone-800">Tesco Engineering BV</strong>, a
              company incorporated in Belgium with its registered office at{" "}
              <strong className="font-medium text-stone-800">
                Heibergstraat 6, 2235 Hulshout, Belgium
              </strong>
              . Our Belgian VAT number (BTW/VAT) is{" "}
              <strong className="font-medium text-stone-800">BE 0477 579 104</strong>. When this
              policy refers to “we”, “us”, or “our”, it means Tesco Engineering BV in relation to
              the PSTUDY service.
            </p>
            <p>
              If you have questions about how we handle personal data, you can reach our privacy
              contact at{" "}
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
            <h2 className="text-xl font-semibold text-stone-900">What data we collect</h2>
            <p>
              We only collect information that we genuinely need to run PSTUDY and to keep it safe.
              Depending on how you use the product, this may include your email address and name
              when you create an account or join the beta, and any optional note you choose to add
              about how you plan to use PSTUDY (for example on the signup form). We store the study
              content you create, such as decks, cards, titles, and any images or attachments you
              upload as part of your decks.
            </p>
            <p>
              When you practise, we record activity that is tied to your account, such as which
              decks you practised, when you practised, and scores or outcomes that the product needs
              in order to show you progress and run the modes you select. If you use the AI deck
              generator, we process the text you submit as input to that feature so we can return a
              generated result. If you take or issue exams through PSTUDY, we store the exam
              results and related data needed to operate exams. If you email us or use support
              channels, we keep the correspondence and any details you volunteer so we can respond
              and improve the service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">
              Why we collect it (legal basis under GDPR)
            </h2>
            <p>
              Most processing is necessary to perform our contract with you: creating and
              maintaining your account, storing and syncing your decks, running practice and exam
              features, and delivering the PSTUDY experience you signed up for. Where we rely on{" "}
              <strong className="font-medium text-stone-800">legitimate interests</strong>, we use
              them in a measured way for running and securing the service, preventing abuse, and
              making sensible product improvements that do not override your rights. Where a
              feature is clearly optional and not required to provide the core service, we will rely
              on <strong className="font-medium text-stone-800">consent</strong> when the law
              requires it, and you can withdraw consent at any time without affecting processing that
              is still lawful on another basis.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">How long we keep it</h2>
            <p>
              We keep account information for as long as your account exists. If you ask us to delete
              your account, we will{" "}
              <strong className="font-medium text-stone-800">anonymise personal data within 30 days</strong>{" "}
              and complete hard deletion of the underlying account record and related personal
              identifiers within <strong className="font-medium text-stone-800">90 days</strong>,
              except where a longer retention is required by law. If an account becomes inactive
              with no meaningful use, we may delete or anonymise it after{" "}
              <strong className="font-medium text-stone-800">three years of inactivity</strong>,
              subject to any legal holds.
            </p>
            <p>
              Deck content remains until you delete it or delete your account. Practice activity is
              kept on a <strong className="font-medium text-stone-800">rolling twelve-month</strong>{" "}
              basis so recent learning history stays available without holding years of detailed
              logs indefinitely. We do not retain a server-side log of the text you submit to AI
              generation. Your input is sent to OpenAI to produce a result, and is not stored in
              PSTUDY{"'"}s own database. OpenAI{"'"}s own retention practices apply to their
              processing — see their Data Privacy Framework commitments.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Who we share it with (processors)</h2>
            <p>
              We use carefully chosen service providers (“processors”) who process personal data on
              our instructions. They may only use the data to provide their service to us. The main
              providers today are:
            </p>
            <p>
              <strong className="font-medium text-stone-800">Supabase</strong> provides
              authentication and the primary application database. Data for PSTUDY is hosted in the{" "}
              <strong className="font-medium text-stone-800">European Union (eu-west-3, Paris,
              France)</strong>. Processing is governed by our agreement with Supabase and standard
              contractual terms required by GDPR.
            </p>
            <p>
              <strong className="font-medium text-stone-800">Vercel</strong> hosts the PSTUDY web
              application. Engineering and edge infrastructure may involve processing in the{" "}
              <strong className="font-medium text-stone-800">United States</strong>. Where data is
              transferred to the United States, we rely on the{" "}
              <strong className="font-medium text-stone-800">EU–US Data Privacy Framework</strong>{" "}
              and supplementary measures as appropriate, together with Vercel’s data processing terms.
            </p>
            <p>
              <strong className="font-medium text-stone-800">OpenAI</strong> powers AI deck
              generation when you use that feature. Processing may take place in the{" "}
              <strong className="font-medium text-stone-800">United States</strong>. We rely on the{" "}
              <strong className="font-medium text-stone-800">Data Privacy Framework</strong> and
              OpenAI’s enterprise / API data processing commitments for transfers and safeguards.
              Per OpenAI{"'"}s API data processing terms, OpenAI may retain API inputs for up to 30
              days for abuse monitoring before deletion. Inputs are not used to train OpenAI{"'"}s
              models when accessed via their API.
            </p>
            <p>
              <strong className="font-medium text-stone-800">Cloud86</strong> provides email
              delivery for transactional messages (for example invitations and security emails).
              Processing occurs in the <strong className="font-medium text-stone-800">Netherlands /
              European Union</strong> in line with our configuration.
            </p>
            <p>
              <strong className="font-medium text-stone-800">Paddle</strong> is listed because we
              intend to use it as the merchant of record for payments when paid plans go live.{" "}
              <strong className="font-medium text-stone-800">
                Paddle is not active during the private beta
              </strong>
              ; when it is enabled, payment-related data will be processed under Paddle’s terms and
              a separate checkout flow. We will update this policy before payments go live.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Where your data is stored</h2>
            <p>
              The authoritative copy of your account and deck data lives in our Supabase database
              in <strong className="font-medium text-stone-800">France (EU)</strong>. The PSTUDY
              website is deployed on Vercel; pages and assets may be cached at edge locations,{" "}
              <strong className="font-medium text-stone-800">
                including within the EU where available
              </strong>
              , so that the application loads quickly. That caching does not change who controls
              your data: Tesco Engineering BV remains responsible, and our processors act on our
              instructions.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Your rights under GDPR</h2>
            <p>
              If EU data protection law applies to you, you have a set of rights that we take
              seriously. You may request <strong className="font-medium text-stone-800">access</strong>{" "}
              to the personal data we hold about you (Article 15 GDPR), and ask us to correct
              inaccurate information (<strong className="font-medium text-stone-800">rectification</strong>
              , Article 16). You may request{" "}
              <strong className="font-medium text-stone-800">erasure</strong> (“right to be
              forgotten”) where the law allows (Article 17), and in many cases you can delete
              content yourself inside the product. You may request{" "}
              <strong className="font-medium text-stone-800">data portability</strong> (Article
              20); PSTUDY supports exporting your decks in a portable text format from the product,
              which is the practical way to move your study material elsewhere. You may also ask for{" "}
              <strong className="font-medium text-stone-800">restriction</strong> of processing
              (Article 18) or <strong className="font-medium text-stone-800">object</strong> to
              processing that is based on legitimate interests (Article 21), and we will respond
              within the time limits set by law.
            </p>
            <p>
              PSTUDY does not perform automated decision-making that produces legal or similarly
              significant effects solely by automated means (Article 22). Features such as AI
              generation are assistive tools; they do not replace human judgement for exams or
              formal assessments on our side.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">How to exercise your rights</h2>
            <p>
              The simplest route is to email{" "}
              <a
                href="mailto:privacy@pstudy.be"
                className="text-pstudy-primary underline hover:no-underline"
              >
                privacy@pstudy.be
              </a>{" "}
              from the address associated with your account (or tell us which account is yours). We
              will confirm receipt and respond within{" "}
              <strong className="font-medium text-stone-800">30 days</strong>. If a request is
              unusually complex, GDPR allows us to extend that period by up to two further months; if
              that happens, we will explain why and keep you informed.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Cookies and similar technologies</h2>
            <p>
              PSTUDY uses a small number of{" "}
              <strong className="font-medium text-stone-800">strictly necessary</strong> first-party
              cookies so that you can stay signed in and so that your browser can complete secure
              authentication with our backend. We do{" "}
              <strong className="font-medium text-stone-800">not</strong> use analytics cookies,
              advertising cookies, or third-party marketing trackers. A short dedicated page
              describes the exact cookies we use: see{" "}
              <a href="/cookies" className="text-pstudy-primary underline hover:no-underline">
                Cookies
              </a>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Right to lodge a complaint</h2>
            <p>
              If you believe we have handled your personal data unlawfully, you have the right to
              lodge a complaint with a supervisory authority.               Our lead supervisory authority is the{" "}
              <strong className="font-medium text-stone-800">
                Belgian Data Protection Authority
              </strong>
              . You can find contact details and filing instructions on their website at{" "}
              <a
                href="https://www.dataprotectionauthority.be"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pstudy-primary underline hover:no-underline"
              >
                dataprotectionauthority.be
              </a>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">Changes to this policy</h2>
            <p>
              We may update this privacy policy from time to time, for example when we launch new
              features, change processors, or need to reflect legal requirements. When we make a{" "}
              <strong className="font-medium text-stone-800">material</strong> change, we will
              notify you in a sensible way—such as a short email to your registered address or a
              clear notice inside the application—so you are not surprised. The “Last updated” date
              at the top will always reflect the latest version.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
