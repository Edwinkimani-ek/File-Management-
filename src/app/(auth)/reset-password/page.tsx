import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata = { title: 'Set a new password · Wakili' };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-lg font-semibold text-ink-900">Set a new password</h1>
      <p className="mt-1 text-sm text-ink-600">
        Saving a new password signs you out everywhere else.
      </p>
      <ResetPasswordForm />
    </>
  );
}
