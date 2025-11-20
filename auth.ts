import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

// 检查必需的环境变量（在初始化前检查）
const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
if (!secret) {
  console.error("❌ 错误: NEXTAUTH_SECRET 或 AUTH_SECRET 未设置！")
  console.error("这会导致 NextAuth 初始化失败")
}

const authUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL
if (!authUrl && process.env.NODE_ENV === "production") {
  console.warn("⚠️ 警告: NEXTAUTH_URL 或 AUTH_URL 未设置")
}

// NextAuth v5 会自动从环境变量读取 secret，不需要在 config 中设置
// 但为了确保正确，我们显式传递
export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  // 确保 secret 被正确传递（NextAuth v5 会从环境变量自动读取，但显式传递更安全）
  secret: secret || undefined,
})

