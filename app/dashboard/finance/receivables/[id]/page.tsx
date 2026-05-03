/**
 * 应收不提供详情页：统一回到列表（避免书签/直链进入）
 */

import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function ReceivableDetailPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }
  redirect('/dashboard/finance/receivables')
}
