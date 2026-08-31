import Link from 'next/link';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata = { title: 'Forgot password · Wakili' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-lg font-semibold text-ink-900">Forgot your password?</h1>
      <p className="mt-1 text-sm text-ink-600">
        We will email you a link to set a new one.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm">
        <Link href="/login" className="text-brand-700 hover:underline">Back to sign in</Link>
      </p>
    </>
  );
}
