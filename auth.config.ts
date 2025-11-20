import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "./lib/prisma"

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = nextUrl
      
      // 公开路由（不需要登录）
      const publicPaths = ["/login", "/api/auth"]
      const isPublicPath = publicPaths.some((path) => pathname.startsWith(path))
      
      // 如果是公开路由，允许访问
      if (isPublicPath) {
        // 如果已登录用户访问登录页，重定向到仪表盘
        if (isLoggedIn && pathname.startsWith("/login")) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
        return true
      }
      
      // 如果未登录且不是公开路由，拒绝访问（会重定向到登录页）
      if (!isLoggedIn) {
        return false
      }
      
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = user.username
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const user = await prisma.users.findUnique({
          where: {
            username: credentials.username as string,
          },
        })

        if (!user || user.status !== "active") {
          return null
        }

        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        )

        if (!passwordsMatch) {
          return null
        }

        return {
          id: user.id.toString(),
          name: user.full_name || user.username,
          email: user.email,
          username: user.username,
          role: user.role || undefined,
        }
      },
    }),
  ],
} satisfies NextAuthConfig

