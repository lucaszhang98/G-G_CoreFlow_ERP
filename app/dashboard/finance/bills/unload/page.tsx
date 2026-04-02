/**
 * 拆柜账单（财务管理）- 数据与接口仍为 /api/wms/unload-bills
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { UnloadBillTable } from './unload-bill-table';

export default async function UnloadBillsPage() {
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
