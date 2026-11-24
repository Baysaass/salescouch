import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import type { Provider } from 'next-auth/providers';
import { authConfig } from './auth.config';
import { getDb, schema } from './db';

const googleId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

export const googleEnabled = Boolean(googleId && googleSecret);
// Google тохиргоо хийгдээгүй локал орчинд туршилтын нэвтрэлт идэвхжинэ
export const devLoginEnabled =
  process.env.AUTH_DEV_LOGIN === 'true' || (!googleEnabled && process.env.NODE_ENV !== 'production');

const providers: Provider[] = [];
if (googleEnabled) {
  providers.push(
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
    }),
  );
}
if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Локал туршилт',
      credentials: { email: { label: 'Имэйл' }, name: { label: 'Нэр' } },
      authorize(creds) {
        const email = String(creds?.email ?? '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
        const name = String(creds?.name ?? '').trim() || email.split('@')[0];
        return { id: email, email, name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  events: {
    async signIn({ user }) {
      if (!user.email) return;
      const db = await getDb();
      const id = user.email.toLowerCase();
      await db
        .insert(schema.users)
        .values({ id, email: id, name: user.name ?? null, image: user.image ?? null })
        .onConflictDoUpdate({
          target: schema.users.id,
          set: { name: user.name ?? null, image: user.image ?? null },
        });
    },
  },
});
