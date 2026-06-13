/** Auth.js v5 (NextAuth) configuration.
 *
 *  Strategy: JWT with the FastAPI access token stored in the session.
 *  The browser only ever sees an httpOnly cookie set by NextAuth.
 *  The FastAPI token is held in the encrypted JWT payload server-side.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";

declare module "next-auth" {
  interface Session {
    apiToken: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.username || !creds?.password) return null;
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const res = await fetch(`${apiBase}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: creds.username,
            password: creds.password,
          }),
          cache: "no-store",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { access_token: string };
        // Return whatever shape we want embedded in the JWT
        return {
          id: creds.username as string,
          name: creds.username as string,
          apiToken: data.access_token,
        } as unknown as DefaultSession["user"] & { apiToken: string };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { apiToken?: string };
        token.apiToken = u.apiToken;
      }
      return token;
    },
    async session({ session, token }) {
      session.apiToken = (token.apiToken as string) ?? "";
      return session;
    },
  },
});
