import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
