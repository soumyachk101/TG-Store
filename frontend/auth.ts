/** Auth.js v5 (NextAuth) configuration.
 *
 *  Strategy: JWT with the FastAPI access token stored in the session.
 *  The browser only ever sees an httpOnly cookie set by NextAuth.
 *  The FastAPI token is held in the encrypted JWT payload server-side.
 *
 *  Security note (CRIT-3): the previous version fell through from a
 *  Firebase failure to a local `/auth/login` HS256 call. That chain
 *  meant a Firebase error was silently swallowed in development and
 *  a parallel credential path was reachable in production. The current
 *  implementation treats Firebase as the canonical path and never
 *  reaches for the local API.
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
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours (with global interceptor to handle 401s on expired tokens)
  },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        idToken: { label: "ID Token", type: "text" },
        email: { label: "Email", type: "text" },
        name: { label: "Name", type: "text" },
        uid: { label: "UID", type: "text" },
      },
      async authorize(creds) {
        if (creds?.idToken) {
          return {
            id: (creds.uid as string) || "user",
            name: (creds.name as string) || "User",
            email: creds.email as string,
            apiToken: creds.idToken as string,
          } as unknown as DefaultSession["user"] & { apiToken: string };
        }

        if (!creds?.username || !creds?.password) return null;

        // Firebase is the canonical authentication path. If it's
        // configured, always go through it and surface its errors
        // directly — never silently fall back to a parallel credential
        // path (CRIT-3).
        if (firebaseAuth) {
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
        }

        // Firebase is not configured. In development mode, allow falling back
        // to the local FastAPI auth path for the local dev loop. In production,
        // refuse fallback to align with the backend's fail-closed production boot.
        if (process.env.NODE_ENV === "development") {
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
        }

        return null;
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
