import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import {
  orderByUsesManualSort,
  stripManualSortFromOrderBy,
} from '@/lib/tms/pickup-management-order-by'

type FindManyArgs = Pick<
  Prisma.pickup_managementFindManyArgs,
  'where' | 'include' | 'select' | 'orderBy' | 'skip' | 'take'
>

/** 列表/导出共用：manual_sort_order 不可用时自动降级排序 */
export async function findPickupManagementMany(args: FindManyArgs) {
  try {
    return await prisma.pickup_management.findMany(args)
  } catch (queryError: unknown) {
    const msg = queryError instanceof Error ? queryError.message : String(queryError)
    if (orderByUsesManualSort(args.orderBy) && msg.includes('manual_sort_order')) {
      console.warn(
        '[pickup-management] manual_sort_order 不可用，已降级为普通排序。请执行 prisma db execute --schema prisma/schema.prisma --file scripts/migrations/add-pickup-manual-sort-order.sql && npx prisma generate'
      )
      return await prisma.pickup_management.findMany({
        ...args,
        orderBy: stripManualSortFromOrderBy(args.orderBy),
      })
    }
    throw queryError
  }
}
