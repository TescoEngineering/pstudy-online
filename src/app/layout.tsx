import type { Metadata } from "next";
import "./globals.css";
import { AuthRedirect } from "@/components/AuthRedirect";
import { ClientProviders } from "@/components/ClientProviders";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "PSTUDY – Study more effectively",
  description:
    "Languages, vocabulary, and any subject: flashcards, speech practice, multiple choice, and timed exams in the browser.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthRedirect />
        <ClientProviders showDevStrip={!user}>{children}</ClientProviders>
      </body>
    </html>
  );
}
