import { redirect } from 'next/navigation';

/** 拆柜账单已迁至财务管理，保留旧链接兼容 */
export default function UnloadBillRedirectPage() {
  redirect('/dashboard/finance/bills/unload');
}
