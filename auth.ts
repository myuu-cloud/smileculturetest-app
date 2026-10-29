import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Google sign-in only. The stable user id is Google's `sub`; email must be verified by Google.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({ clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET })],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    signIn({ profile }) { return profile?.email_verified === true; },
    jwt({ token, profile }) { if (profile) { token.sub = String(profile.sub ?? token.sub); } return token; },
    session({ session, token }) { if (session.user && token.sub) (session.user as { id?: string }).id = token.sub; return session; },
  },
});
