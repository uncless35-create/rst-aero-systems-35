import type { NextAuthConfig } from "next-auth";

/**
 * Базовая конфигурация без провайдеров и Prisma — безопасна для edge (middleware).
 * Полная конфигурация с Credentials/Prisma — в auth.ts (Node runtime).
 */
export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? "CUSTOMER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "CUSTOMER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
