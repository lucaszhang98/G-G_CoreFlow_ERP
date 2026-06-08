import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  buildGoogleOAuthRedirectUri,
  createGoogleOAuthClient,
  exchangeGoogleAuthCode,
  saveGoogleWorkspaceEmail,
  saveGoogleWorkspaceTokens,
} from '@/lib/google/workspace-oauth'
import { google } from 'googleapis'

const SUCCESS_REDIRECT = '/dashboard/settings/mail-assistant?google=connected'
const ERROR_REDIRECT = '/dashboard/settings/mail-assistant?google=error'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(new URL(`${ERROR_REDIRECT}&reason=${oauthError}`, request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL(`${ERROR_REDIRECT}&reason=missing_params`, request.url))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('google_oauth_state')?.value
  const redirectUri =
    cookieStore.get('google_oauth_redirect_uri')?.value ??
    buildGoogleOAuthRedirectUri(request.nextUrl.origin)
  cookieStore.delete('google_oauth_state')
  cookieStore.delete('google_oauth_redirect_uri')

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL(`${ERROR_REDIRECT}&reason=invalid_state`, request.url))
  }

  try {
    const tokens = await exchangeGoogleAuthCode(code, redirectUri)
    await saveGoogleWorkspaceTokens(tokens)

    const authClient = createGoogleOAuthClient(redirectUri)
    authClient.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: authClient })
    const userInfo = await oauth2.userinfo.get()
    if (userInfo.data.email) {
      await saveGoogleWorkspaceEmail(userInfo.data.email)
    }

    return NextResponse.redirect(new URL(SUCCESS_REDIRECT, request.url))
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(new URL(`${ERROR_REDIRECT}&reason=token_exchange`, request.url))
  }
}
