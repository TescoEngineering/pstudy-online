import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-6 text-xl font-bold text-stone-900">Log in</h1>
        <p className="mb-4 text-sm text-stone-600">
          Full authentication (email/password or OAuth) can be added with
          NextAuth.js or Supabase Auth. For now, use the app without login —
          data is stored in your browser.
        </p>
        <Link href="/dashboard" className="btn-primary block text-center">
          Continue to app
        </Link>
        <p className="mt-4 text-center text-sm text-stone-500">
          <Link href="/" className="text-pstudy-primary hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
