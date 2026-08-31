import Link from 'next/link';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in · Wakili' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <>
      <h1 className="text-lg font-semibold text-ink-900">Sign in</h1>
      <p className="mt-1 text-sm text-ink-600">Use the email address your firm registered.</p>
      <LoginForm next={searchParams.next} initialError={searchParams.error} />
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-brand-700 hover:underline">
          Register a firm
        </Link>
      </div>
    </>
  );
}
