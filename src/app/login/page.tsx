import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { auth, devLoginEnabled, googleEnabled, signIn } from '@/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/');

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-panel p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src="/app-icon.png"
            alt="InsurTech Sales Coach Logo"
            className="h-10 w-10 rounded-xl shadow-sm object-cover"
          />
          <div>
            <span className="text-[15px] font-semibold block leading-tight text-ink">InsurTech Sales Coach</span>
            <span className="text-[11.5px] font-medium text-emerald-800">Practical Insurance AI</span>
          </div>
        </div>
        <h1 className="mt-7 text-[22px] font-semibold tracking-tight">Нэвтрэх</h1>
        <p className="mt-1.5 text-sm text-ink-2">
          Харилцагчид, persona болон чатын түүх тань таны бүртгэлд хадгалагдана.
        </p>

        {googleEnabled && (
          <form
            className="mt-6"
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: '/' });
            }}
          >
            <button className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white text-sm font-medium hover:bg-hover">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
              </svg>
              Gmail-ээр нэвтрэх
            </button>
          </form>
        )}

        {!googleEnabled && process.env.NODE_ENV !== 'production' && (
          <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Gmail нэвтрэлт тохируулагдаагүй байна. Туршилтын горимоор нэвтэрнэ үү.
          </p>
        )}

        {devLoginEnabled && (
          <form
            className="mt-6 space-y-3 border-t border-line pt-6"
            action={async (fd: FormData) => {
              'use server';
              await signIn('dev', { email: fd.get('email'), name: fd.get('name'), redirectTo: '/' });
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Туршилтын нэвтрэлт</p>
            <input name="name" placeholder="Нэр" className="h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand" />
            <input name="email" type="email" required placeholder="you@gmail.com" className="h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand" />
            <button className="h-10 w-full rounded-lg bg-ink text-sm font-medium text-white hover:bg-black">Үргэлжлүүлэх</button>
          </form>
        )}
      </div>
    </main>
  );
}
