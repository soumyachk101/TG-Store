/** Auth.js v5 (NextAuth) configuration.
 *
 *  Strategy: JWT with the FastAPI access token stored in the session.
 *  The browser only ever sees an httpOnly cookie set by NextAuth.
 *  The FastAPI token is held in the encrypted JWT payload server-side.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";

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
        username: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.username || !creds?.password) return null;

        // 1. Try Firebase Authentication
        if (firebaseAuth) {
          try {
            const userCredential = await signInWithEmailAndPassword(
              firebaseAuth,
              creds.username as string,
              creds.password as string
            );
            const idToken = await userCredential.user.getIdToken();
            return {
              id: userCredential.user.uid,
              name: userCredential.user.displayName || userCredential.user.email || "User",
              email: userCredential.user.email,
              apiToken: idToken,
            } as unknown as DefaultSession["user"] & { apiToken: string };
          } catch (firebaseErr) {
            console.log("Firebase auth failed, trying local fallback:", firebaseErr);
          }
        }

        // 2. Fallback to standard local API auth
        try {
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
          return {
            id: creds.username as string,
            name: creds.username as string,
            apiToken: data.access_token,
          } as unknown as DefaultSession["user"] & { apiToken: string };
        } catch (localErr) {
          console.error("Local auth fallback failed:", localErr);
          return null;
        }
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
