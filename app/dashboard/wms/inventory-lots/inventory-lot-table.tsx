'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { EntityTable } from '@/components/crud/entity-table';
import { inventoryLotConfig } from '@/lib/crud/configs/inventory-lots';
import type { ClickableColumnConfig } from '@/lib/table/config';

export function InventoryLotTable() {
  const router = useRouter();
  
  const customClickableColumns: ClickableColumnConfig<any>[] = React.useMemo(() => [
    {
      columnId: "container_number",
      onClick: (row: any) => {
        if (row.order_id) {
          router.push(`/dashboard/oms/orders/${row.order_id}`);
        }
      },
      disabled: (row: any) => !row.order_id,
      showIcon: true,
      bold: true,
      getTitle: (row: any) =>
        row.order_id
          ? `点击查看订单详情 (订单ID: ${row.order_id})`
          : "无法查看详情：缺少订单ID",
    },
  ], [router]);

  return (
    <EntityTable
      config={inventoryLotConfig}
      customClickableColumns={customClickableColumns}
    />
  );
}

