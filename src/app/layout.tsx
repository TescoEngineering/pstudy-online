import type { Metadata } from "next";
import "./globals.css";
import { AuthRedirect } from "@/components/AuthRedirect";
import { ClientProviders } from "@/components/ClientProviders";

export const metadata: Metadata = {
  title: "PSTUDY – Study more effectively",
  description:
    "Languages, vocabulary, and any subject: flashcards, speech practice, multiple choice, and timed exams in the browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthRedirect />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
