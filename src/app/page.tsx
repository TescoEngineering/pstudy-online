import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-stone-100">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-2xl font-bold text-pstudy-primary">PSTUDY</span>
          <nav className="flex gap-4">
            <Link
              href="/login"
              className="text-stone-600 hover:text-pstudy-primary"
            >
              Log in
            </Link>
            <a href="/dashboard" className="btn-primary cursor-pointer no-underline">
              Get started
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-stone-900 md:text-5xl">
          Study more effectively
        </h1>
        <p className="mb-10 text-lg text-stone-600">
          Build exercises for languages, vocabulary, or any subject. Practice
          with straight answer or multiple choice, and take timed exams — now
          online.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="/dashboard"
            className="btn-primary cursor-pointer text-lg no-underline"
          >
            Open app
          </a>
          <a
            href="/import"
            className="btn-secondary cursor-pointer text-lg no-underline"
          >
            Import .txt file
          </a>
        </div>

        <section className="mt-20 text-left">
          <h2 className="mb-6 text-2xl font-semibold text-stone-800">
            Features
          </h2>
          <ul className="grid gap-3 text-stone-600 md:grid-cols-2">
            <li>✓ Straight answer and multiple choice</li>
            <li>✓ Timed examinations</li>
            <li>✓ Random order and repeat mistakes</li>
            <li>✓ Import your existing PSTUDY .txt files</li>
            <li>✓ Works on any device in the browser</li>
            <li>✓ No installation — always up to date</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-sm text-stone-500">
        PSTUDY · Tesco Engineering bv ·{" "}
        <a
          href="https://www.pstudy.be"
          target="_blank"
          rel="noopener noreferrer"
          className="text-pstudy-primary hover:underline"
        >
          www.pstudy.be
        </a>
      </footer>
    </div>
  );
}
