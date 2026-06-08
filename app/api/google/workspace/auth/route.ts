import { NextRequest, NextResponse } from 'next/server'
import { checkMailAssistantPermission } from '@/lib/mail-assistant/mail-assistant-permissions'
import {
  buildGoogleOAuthRedirectUri,
  getGoogleAuthUrl,
} from '@/lib/google/workspace-oauth'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  const perm = await checkMailAssistantPermission()
  if (perm.error) return perm.error

  try {
    const state = randomBytes(24).toString('hex')
    const redirectUri = buildGoogleOAuthRedirectUri(request.nextUrl.origin)
    const cookieStore = await cookies()
    cookieStore.set('google_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
      path: '/',
    })
    cookieStore.set('google_oauth_redirect_uri', redirectUri, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
      path: '/',
    })

    return NextResponse.redirect(getGoogleAuthUrl(state, redirectUri))
  } catch (error) {
    console.error('Google OAuth start error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '启动 Google 授权失败' },
      { status: 500 }
    )
  }
}
