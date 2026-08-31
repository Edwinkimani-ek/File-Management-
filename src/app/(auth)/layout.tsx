import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center">
          <span className="text-2xl font-semibold tracking-tight text-brand-700">Wakili</span>
          <span className="ml-2 text-sm text-ink-500">Case Manager</span>
        </Link>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}
