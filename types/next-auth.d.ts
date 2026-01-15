import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: "ADMIN" | "KASIR"
    } & DefaultSession["user"]
  }

  interface User {
    role: "ADMIN" | "KASIR"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "ADMIN" | "KASIR"
  }
}
