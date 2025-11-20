import { NextResponse } from "next/server"

export async function GET() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  const authUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL
  const dbUrl = process.env.DATABASE_URL

  return NextResponse.json({
    hasSecret: !!secret,
    secretLength: secret ? secret.length : 0,
    hasAuthUrl: !!authUrl,
    authUrl: authUrl || "未设置",
    hasDbUrl: !!dbUrl,
    dbUrlPrefix: dbUrl ? dbUrl.substring(0, 20) + "..." : "未设置",
    nodeEnv: process.env.NODE_ENV,
  })
}

