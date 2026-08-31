import { requireSession } from '@/lib/auth';
import { signOutAction } from '@/app/(auth)/actions';
import { Nav } from '@/components/layout/Nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, firm } = await requireSession();

  const signOut = (
    <form action={signOutAction}>
      <button type="submit" className="btn-secondary w-full">
        Sign out
      </button>
    </form>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Nav role={user.role} firmName={firm.name} userName={user.full_name} signOut={signOut} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
