import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    authenticatedAt?: number;
    user: {
      id?: string;
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    authenticatedAt?: number;
    id?: string;
    email?: string | null;
    name?: string | null;
    picture?: string | null;
    role?: string;
  }
}
