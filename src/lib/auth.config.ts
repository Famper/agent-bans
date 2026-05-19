import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/signin",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const isAuthPage = pathname === "/signin" || pathname === "/signup";
      const isPublicApi =
        pathname.startsWith("/api/auth") ||
        pathname === "/api/health";

      if (isPublicApi) return true;
      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name ?? null;
        token.email = user.email ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        if (token.name !== undefined) session.user.name = token.name as string | null;
        if (token.email !== undefined) session.user.email = token.email as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
