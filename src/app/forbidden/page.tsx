import Link from 'next/link';

export const metadata = { title: 'Not permitted · Wakili' };

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 text-center">
      <h1 className="text-xl font-semibold text-ink-900">You do not have access to that page</h1>
      <p className="mt-2 max-w-md text-sm text-ink-600">
        Your role does not include this part of the system. If you believe that is wrong, ask a
        partner at your firm to review your role.
      </p>
      <Link href="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
    </main>
  );
}
