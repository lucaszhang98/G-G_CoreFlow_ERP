import { Suspense } from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { canAccessMailAssistant } from '@/lib/mail-assistant/mail-assistant-permissions'
import { Loader2 } from 'lucide-react'
import { ForecastFileClient } from './forecast-file-client'

export const metadata = {
  title: 'Excel 预览 | 邮件助手',
}

export default async function ForecastFilePage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }
  if (!canAccessMailAssistant(session.user.role)) {
    redirect('/dashboard')
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            打开 Excel…
          </div>
        }
      >
        <ForecastFileClient />
      </Suspense>
    </DashboardLayout>
  )
}
