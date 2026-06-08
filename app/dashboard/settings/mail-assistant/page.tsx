import { Suspense } from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { canAccessMailAssistant } from '@/lib/mail-assistant/mail-assistant-permissions'
import { MailAssistantClient } from './mail-assistant-client'
import { Loader2 } from 'lucide-react'

export const metadata = {
  title: '邮件助手 | 系统工具',
  description: '从 Google Sheet 对比柜号，并从 Gmail 拉取提柜附件',
}

export default async function MailAssistantPage() {
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
            加载中…
          </div>
        }
      >
        <MailAssistantClient userRole={session.user.role} />
      </Suspense>
    </DashboardLayout>
  )
}
