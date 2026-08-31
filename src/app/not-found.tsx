import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 text-center">
      <h1 className="text-xl font-semibold text-ink-900">Not found</h1>
      <p className="mt-2 max-w-md text-sm text-ink-600">
        This record does not exist, or it belongs to another firm.
      </p>
      <Link href="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
    </main>
  );
}
