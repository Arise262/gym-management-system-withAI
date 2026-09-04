import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the Auth.js config.
 *
 * middleware.ts runs on the Edge runtime, where bcryptjs and Prisma cannot run.
 * So the providers array is intentionally empty here and gets filled in
 * src/lib/auth.ts, which only ever runs in Node. Both halves share these
 * callbacks so the JWT shape is identical in middleware and in server actions.
 */
export const authConfig = {
  // Derive the origin from the incoming request instead of a hardcoded
  // AUTH_URL. Without this, redirects are pinned to whatever AUTH_URL says —
  // so running on any port but 3000, or deploying, sends users to a dead host.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only populated on initial sign-in.
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.memberId = user.memberId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.memberId = token.memberId;
      return session;
    },
  },
} satisfies NextAuthConfig;
