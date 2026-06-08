import { google } from 'googleapis'
import {
  deleteSystemConfigValue,
  getSystemConfigValue,
  setSystemConfigValue,
} from '@/lib/google/system-config-store'

export const GOOGLE_WORKSPACE_CONFIG_KEYS = {
  refreshToken: 'google_workspace_refresh_token',
  email: 'google_workspace_email',
} as const

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function buildGoogleOAuthRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/google/workspace/callback`
}

export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

export function getGoogleOAuthRedirectUri(origin?: string): string {
  if (origin) return buildGoogleOAuthRedirectUri(origin)
  return buildGoogleOAuthRedirectUri(getAppBaseUrl())
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function createGoogleOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('未配置 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET')
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri ?? getGoogleOAuthRedirectUri()
  )
}

export function getGoogleAuthUrl(state: string, redirectUri: string): string {
  const client = createGoogleOAuthClient(redirectUri)
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_WORKSPACE_SCOPES,
    state,
  })
}

export async function exchangeGoogleAuthCode(code: string, redirectUri: string) {
  const client = createGoogleOAuthClient(redirectUri)
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function saveGoogleWorkspaceTokens(tokens: {
  refresh_token?: string | null
}) {
  if (!tokens.refresh_token) {
    throw new Error('Google 未返回 refresh_token，请先在 Google 账号中撤销本应用授权后重新连接')
  }

  await setSystemConfigValue(
    GOOGLE_WORKSPACE_CONFIG_KEYS.refreshToken,
    tokens.refresh_token,
    'Google Workspace OAuth refresh token'
  )
}

export async function saveGoogleWorkspaceEmail(email: string) {
  await setSystemConfigValue(
    GOOGLE_WORKSPACE_CONFIG_KEYS.email,
    email,
    '已授权的 Google Workspace 邮箱'
  )
}

export async function clearGoogleWorkspaceCredentials() {
  await Promise.all([
    deleteSystemConfigValue(GOOGLE_WORKSPACE_CONFIG_KEYS.refreshToken),
    deleteSystemConfigValue(GOOGLE_WORKSPACE_CONFIG_KEYS.email),
  ])
}

export async function getGoogleWorkspaceConnectionStatus(origin?: string) {
  const [refreshToken, email] = await Promise.all([
    getSystemConfigValue(GOOGLE_WORKSPACE_CONFIG_KEYS.refreshToken),
    getSystemConfigValue(GOOGLE_WORKSPACE_CONFIG_KEYS.email),
  ])

  return {
    connected: Boolean(refreshToken),
    email,
    oauthConfigured: isGoogleOAuthConfigured(),
    redirectUri: getGoogleOAuthRedirectUri(origin),
    currentOrigin: origin ?? null,
  }
}

export async function getAuthenticatedGoogleClient() {
  const refreshToken = await getSystemConfigValue(GOOGLE_WORKSPACE_CONFIG_KEYS.refreshToken)
  if (!refreshToken) {
    throw new Error('尚未连接 Google 账号，请先在邮件助手中完成 OAuth 授权')
  }

  const client = createGoogleOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

export async function getGmailClient() {
  const auth = await getAuthenticatedGoogleClient()
  return google.gmail({ version: 'v1', auth })
}

export async function getSheetsClient() {
  const auth = await getAuthenticatedGoogleClient()
  return google.sheets({ version: 'v4', auth })
}
