'use client';

import * as React from 'react';
import { EntityTable } from '@/components/crud/entity-table';
import { unloadBillConfig } from '@/lib/crud/configs/unload-bills';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DollarSign, FileDown } from 'lucide-react';

const ID_FIELD = 'inbound_receipt_id';

/** 本周 = 上周五 到这周四（按用户本地日期，保证“本周”不会跑到下周） */
function getUnloadBillWeekRange(): { planned_unload_at_from: string; planned_unload_at_to: string } {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat（本地）
  const daysToLastFriday = (day + 2) % 7; // Fri->0, Sat->1, Sun->2, Mon->3, Tue->4, Wed->5, Thu->6
  const lastFriday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysToLastFriday);
  const thisThursday = new Date(lastFriday.getFullYear(), lastFriday.getMonth(), lastFriday.getDate() + 6);
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return {
    planned_unload_at_from: fmt(lastFriday),
    planned_unload_at_to: fmt(thisThursday),
  };
}

export function UnloadBillTable() {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [selectedRows, setSelectedRows] = React.useState<any[]>([]);
  const [applyingDefaults, setApplyingDefaults] = React.useState(false);

  const applyDefaultPrices = React.useCallback(async () => {
    const ids = selectedRows.map((r) => r[ID_FIELD]).filter(Boolean);
    if (ids.length === 0) {
      toast.error('请先勾选要填充默认价格的记录');
      return;
    }
    setApplyingDefaults(true);
    try {
      const res = await fetch('/api/wms/unload-bills/apply-default-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inbound_receipt_ids: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');
      toast.success(`已为 ${data.updated ?? ids.length} 条记录填充默认价格（francisco=210，其他=200）`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量填充默认价格失败');
    } finally {
      setApplyingDefaults(false);
    }
  }, [selectedRows]);

  const handleExportByPerson = React.useCallback(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    params.delete('page');
    params.delete('limit');
    const qs = params.toString();
    const url = `/api/wms/unload-bills/export${qs ? `?${qs}` : ''}`;
    if (typeof window !== 'undefined') window.open(url, '_blank');
  }, []);

  const customFilterContent = React.useCallback(
    (applyFilterValues: (v: Record<string, string>) => void) => (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-lg"
          onClick={() => applyFilterValues(getUnloadBillWeekRange())}
        >
          显示本周数据
        </Button>
        <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={handleExportByPerson}>
          <FileDown className="mr-2 h-4 w-4" />
          导出（按拆柜人员分类）
        </Button>
      </div>
    ),
    [handleExportByPerson]
  );

  const customBatchActions = React.useMemo(
    () => (
      <Button
        size="sm"
        variant="outline"
        onClick={applyDefaultPrices}
        disabled={applyingDefaults || selectedRows.length === 0}
        className="min-w-[140px]"
      >
        <DollarSign className="mr-2 h-4 w-4" />
        {applyingDefaults ? '处理中...' : '批量填充默认价格'}
      </Button>
    ),
    [applyDefaultPrices, applyingDefaults, selectedRows.length]
  );

  return (
    <EntityTable
      config={unloadBillConfig}
      refreshKey={refreshKey}
      customFilterContent={customFilterContent}
      customBatchActions={customBatchActions}
      onRowSelectionChange={setSelectedRows}
    />
  );
}
