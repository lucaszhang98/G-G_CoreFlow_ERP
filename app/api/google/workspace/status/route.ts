import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { getForecastAiStatus } from '@/lib/mail-assistant/forecast-ai-config'
import { getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'

export async function GET(request: NextRequest) {
  const perm = await checkPermission(['admin'])
  if (perm.error) return perm.error

  const status = await getGoogleWorkspaceConnectionStatus(request.nextUrl.origin)
  return NextResponse.json({
    ...status,
    authMode: 'oauth',
    forecastAi: getForecastAiStatus(),
  })
}
