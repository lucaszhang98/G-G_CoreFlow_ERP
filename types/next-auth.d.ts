import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      username?: string
      role?: string
    }
  }

  interface User {
    id: string
    username?: string
    role?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    username?: string
    role?: string
    name?: string // 添加 name 字段到 JWT token
  }
}

