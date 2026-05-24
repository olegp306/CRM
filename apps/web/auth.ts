import { createAdminEmailAllowlist, isAdminEmailAllowed } from "@app/auth";
import type { NextAuthOptions, Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export function getAllowedAdminEmails(): Set<string> {
  return createAdminEmailAllowlist(process.env.CRM_ALLOWED_ADMIN_EMAILS);
}

export function isGoogleAdminAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.CRM_ALLOWED_ADMIN_EMAILS);
}

export function isSessionAllowed(session: Session | null): boolean {
  if (!isGoogleAdminAuthConfigured()) {
    return true;
  }

  return isAdminEmailAllowed(session?.user?.email, getAllowedAdminEmails());
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
    })
  ],
  pages: {
    signIn: "/login",
    error: "/access-denied"
  },
  callbacks: {
    signIn({ user, profile }) {
      if (!isGoogleAdminAuthConfigured()) {
        return true;
      }

      const email = user.email ?? (typeof profile?.email === "string" ? profile.email : null);
      return isAdminEmailAllowed(email, getAllowedAdminEmails()) ? true : "/access-denied";
    },
    session({ session }) {
      return session;
    }
  }
};
