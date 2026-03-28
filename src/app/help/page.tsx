"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";

function RichLine({ children }: { children: string }) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-medium text-stone-800">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split("\n\n").map((p, i) => (
        <p key={i} className="mt-3 leading-relaxed text-stone-600 first:mt-0">
          <RichLine>{p}</RichLine>
        </p>
      ))}
    </>
  );
}

function ContactForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);

  const supportEmail =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPPORT_EMAIL
      ? process.env.NEXT_PUBLIC_SUPPORT_EMAIL
      : "";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled && user?.email) setEmail((e) => e || user.email || "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          website: honeypot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && data.code === "not_configured") {
        toast.error(t("help.contactNotConfigured"));
        return;
      }
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "send failed");
      toast.success(t("help.contactSuccess"));
      setMessage("");
      setSubject("");
    } catch {
      toast.error(t("help.contactError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4">
      <form onSubmit={handleSubmit} className="relative card max-w-xl space-y-4 border border-stone-200 bg-white p-4">
        <div className="sr-only" aria-hidden>
          <label htmlFor="contact-website">{t("help.contactHoneypotLabel")}</label>
          <input
            id="contact-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="contact-name" className="mb-1 block text-sm font-medium text-stone-700">
            {t("help.contactName")}
          </label>
          <input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-stone-700">
            {t("help.contactEmail")}
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
          />
        </div>
        <div>
          <label htmlFor="contact-subject" className="mb-1 block text-sm font-medium text-stone-700">
            {t("help.contactSubject")}
          </label>
          <input
            id="contact-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
          />
        </div>
        <div>
          <label htmlFor="contact-message" className="mb-1 block text-sm font-medium text-stone-700">
            {t("help.contactMessage")}
          </label>
          <textarea
            id="contact-message"
            required
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
          />
        </div>
        <button type="submit" disabled={sending} className="btn-primary disabled:opacity-60">
          {sending ? t("help.contactSending") : t("help.contactSubmit")}
        </button>
        {supportEmail ? (
          <p className="text-sm text-stone-500">
            {t("help.contactMailtoHint")}{" "}
            <a href={`mailto:${supportEmail}`} className="text-pstudy-primary hover:underline">
              {supportEmail}
            </a>
          </p>
        ) : null}
      </form>
    </div>
  );
}

export default function HelpPage() {
  const { t } = useTranslation();

  const sections = [
    { id: "getting-started", titleKey: "help.sectionGettingStarted", bodyKey: "help.bodyGettingStarted" },
    { id: "decks", titleKey: "help.sectionDecks", bodyKey: "help.bodyDecks" },
    { id: "practice", titleKey: "help.sectionPractice", bodyKey: "help.bodyPractice" },
    { id: "import", titleKey: "help.sectionImport", bodyKey: "help.bodyImport" },
    { id: "exams", titleKey: "help.sectionExams", bodyKey: "help.bodyExams" },
    { id: "community", titleKey: "help.sectionCommunity", bodyKey: "help.bodyCommunity" },
    { id: "speech", titleKey: "help.sectionSpeech", bodyKey: "help.bodySpeech" },
    { id: "more-help", titleKey: "help.sectionMoreHelp", bodyKey: "help.bodyMoreHelp" },
    { id: "contact", titleKey: "help.sectionContact", bodyKey: "help.bodyContact", form: true },
  ] as const;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-4">
          <div className="shrink-0">
            <Logo size="sm" withText />
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:justify-end">
            <Link href="/" className="text-stone-600 hover:text-pstudy-primary">
              {t("help.navHome")}
            </Link>
            <Link href="/dashboard" className="text-stone-600 hover:text-pstudy-primary">
              {t("dashboard.myDecks")}
            </Link>
            <Link href="/login" className="text-stone-600 hover:text-pstudy-primary">
              {t("home.logIn")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900">{t("help.pageTitle")}</h1>
        <p className="mt-3 text-stone-600">{t("help.intro")}</p>

        <nav
          aria-label={t("help.tocLabel")}
          className="card mt-8 border border-stone-200 bg-white p-4 text-sm"
        >
          <p className="mb-2 font-medium text-stone-800">{t("help.tocHeading")}</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-pstudy-primary hover:underline">
                  {t(s.titleKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 space-y-12">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-stone-900">{t(s.titleKey)}</h2>
              <div className="mt-2">
                <Prose text={t(s.bodyKey)} />
              </div>
              {"form" in s && s.form ? <ContactForm /> : null}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
