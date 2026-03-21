import type { Metadata } from "next";
import "./globals.css";
import { AuthRedirect } from "@/components/AuthRedirect";

export const metadata: Metadata = {
  title: "PSTUDY – Study more effectively",
  description:
    "Study languages, vocabulary, and any subject with custom exercises. Practice and exams online.",
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
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
          PSTUDY Online is under construction. Features may change.
        </div>
        {children}
      </body>
    </html>
  );
}
