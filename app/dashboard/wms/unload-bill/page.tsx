/**
 * 拆柜账单 - 使用通用表格框架，数据来自入库管理
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { UnloadBillTable } from './unload-bill-table';

export default async function UnloadBillPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <UnloadBillTable />
    </DashboardLayout>
  );
}
