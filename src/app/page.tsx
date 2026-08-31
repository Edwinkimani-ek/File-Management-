import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-brand-700">Wakili</h1>
      <p className="mt-2 text-ink-600">File and case management for Kenyan law firms.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/login" className="btn-primary">Sign in</Link>
        <Link href="/signup" className="btn-secondary">Register a firm</Link>
      </div>
    </main>
  );
}
