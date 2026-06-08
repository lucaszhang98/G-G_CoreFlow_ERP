import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { clearGoogleWorkspaceCredentials } from '@/lib/google/workspace-oauth'

export async function POST() {
  const perm = await checkPermission(['admin'])
  if (perm.error) return perm.error

  await clearGoogleWorkspaceCredentials()
  return NextResponse.json({ success: true })
}
