import Link from 'next/link';
import { SignUpForm } from './SignUpForm';

export const metadata = { title: 'Register a firm · Wakili' };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-lg font-semibold text-ink-900">Register your firm</h1>
      <p className="mt-1 text-sm text-ink-600">
        You become the first Partner and can invite the rest of the firm afterwards.
      </p>
      <SignUpForm />
      <p className="mt-6 text-sm text-ink-600">
        Already registered?{' '}
        <Link href="/login" className="text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
