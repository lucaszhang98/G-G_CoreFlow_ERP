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
        secure: true,
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
          console.log("认证失败: 缺少用户名或密码")
          return null
        }

        try {
          // 延迟加载 Prisma，避免在 Edge Middleware 中被检测到
          const { default: prisma } = await import("./lib/prisma")

          const user = await prisma.users.findUnique({
            where: {
              username: credentials.username as string,
            },
          })

          if (!user) {
            console.log(`认证失败: 用户 ${credentials.username} 不存在`)
            return null
          }

          if (user.status !== "active") {
            console.log(`认证失败: 用户 ${credentials.username} 状态为 ${user.status}`)
            return null
          }

          const passwordsMatch = await bcrypt.compare(
            credentials.password as string,
            user.password_hash
          )

          if (!passwordsMatch) {
            console.log(`认证失败: 用户 ${credentials.username} 密码错误`)
            return null
          }

          console.log(`认证成功: 用户 ${credentials.username} 登录成功`)
          return {
            id: user.id.toString(),
            name: user.full_name || user.username,
            email: user.email,
            username: user.username,
            role: user.role || undefined,
          }
        } catch (error) {
          console.error("Authentication error:", error)
          return null
        }
      },
    }),
  ],
  // 信任的主机（用于生产环境）
  trustHost: true,
  // 调试模式（生产环境也开启，帮助诊断）
  debug: process.env.NODE_ENV === "production",
} satisfies NextAuthConfig

