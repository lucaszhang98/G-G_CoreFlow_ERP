import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        // 在 localhost (HTTP) 上设置为 false，在生产环境 (HTTPS) 上设置为 true
        // Safari 对 cookie 处理更严格，localhost 必须使用 secure: false
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      // 如果 user 存在，更新 token
      if (user) {
        token.id = user.id || ""
        token.username = user.username || undefined
        token.role = user.role || undefined
        // 确保 name 也被存储（用于 session 中显示）
        token.name = user.name || user.username || user.id || ""
      }
      // 确保 token 始终返回
      return token || {}
    },
    async session({ session, token }) {
      // 如果 session 不存在，返回空对象
      if (!session) {
        return { user: {} } as any
      }

      // 如果 session.user 不存在，创建它
      if (!session.user) {
        session.user = {} as any
      }

      // 安全地填充用户信息
      if (token) {
        session.user.id = token.id ? String(token.id) : ""
        session.user.username = token.username ? String(token.username) : undefined
        session.user.role = token.role ? String(token.role) : undefined
        session.user.name = token.name ? String(token.name) : (token.username ? String(token.username) : undefined)
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

        try {
          const { default: prisma } = await import("./lib/prisma")

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
            username: user.username,
            role: user.role || undefined,
          }
        } catch (error) {
          return null
        }
      },
    }),
  ],
  trustHost: true,
} satisfies NextAuthConfig

