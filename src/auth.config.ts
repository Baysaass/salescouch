import type { NextAuthConfig } from 'next-auth';

// Edge (middleware)-д ажиллах хөнгөн тохиргоо — DB импортлохгүй
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV !== 'production' ? 'local-dev-secret-change-me-0123456789abcdef' : undefined),
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      if (pathname.startsWith('/login')) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user?.email) token.uid = user.email.toLowerCase();
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.uid === 'string') session.user.id = token.uid;
      return session;
    },
  },
} satisfies NextAuthConfig;
