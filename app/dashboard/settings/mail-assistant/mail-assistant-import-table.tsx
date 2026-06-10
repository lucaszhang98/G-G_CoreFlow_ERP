"use client"

import * as React from "react"
import { type ColumnDef, type HeaderContext } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/crud/default-list-pagination"
import { copyTextToClipboard } from "@/lib/utils/copy-to-clipboard"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  XCircle,
  Container,
  Building2,
  CalendarDays,
  CircleCheck,
  Copy,
  FileSpreadsheet,
  Loader2,
  FileInput,
} from "lucide-react"
import { toast } from "sonner"
import { buildForecastFilePageUrl } from "./forecast-file-url"

export type SourceForecastCell = {
  status: "idle" | "loading" | "found" | "not_found"
  label?: string
  downloadUrl?: string
  gmailUrl?: string
  messageId?: string
  attachmentId?: string
  aiResolved?: boolean
  resolveReason?: string
  /** 持久化缓存的导入预报下载地址 */
  importDraftDownloadUrl?: string
  /** 正在执行「转换源预报」 */
  importDraftConverting?: boolean
}

export type ImportDraftCell = {
  status: "idle" | "loading" | "ready"
  downloadUrl?: string
}

export type MailAssistantImportRow = {
  containerNumber: string
  customerRaw?: string | null
  customerCode?: string | null
  customerMatchKind?: string | null
  orderDate: string
  orderDateKey: string
  imported: boolean
  sourceForecast?: SourceForecastCell
  importDraft?: ImportDraftCell
}

type MailAssistantImportTableProps = {
  rows: MailAssistantImportRow[]
  loading?: boolean
  filterSignature?: string
  onRowSelectionChange?: (rows: MailAssistantImportRow[]) => void
}

/** 柜号可能重复（不同订单日期），行 ID 必须唯一 */
export function getMailAssistantRowId(row: MailAssistantImportRow): string {
  return `${row.containerNumber}|${row.orderDateKey}`
}

function ColumnHeader({
  icon: Icon,
  label,
  className,
}: {
  icon: React.ElementType
  label: string
  className?: string
}) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 font-semibold text-[13px] tracking-wide", className)}>
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span>{label}</span>
    </div>
  )
}

function buildColumns(
  onCopyContainer: (containerNumber: string) => void
): ColumnDef<MailAssistantImportRow>[] {
  return [
    {
      accessorKey: "containerNumber",
      id: "containerNumber",
      header: () => <ColumnHeader icon={Container} label="柜号" className="justify-start" />,
      size: 180,
      minSize: 140,
      meta: { alignLeft: true },
      cell: ({ row }) => (
        <div className="flex items-center gap-2 group/cell">
          <span className="font-semibold tracking-wide text-foreground">
            {row.original.containerNumber}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
            title="复制柜号"
            onClick={(e) => {
              e.stopPropagation()
              onCopyContainer(row.original.containerNumber)
            }}
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      ),
    },
    {
      accessorKey: "customerCode",
      id: "customerCode",
      header: () => <ColumnHeader icon={Building2} label="客户" className="justify-start" />,
      size: 120,
      minSize: 96,
      meta: { alignLeft: true },
      cell: ({ row }) => {
        const code = row.original.customerCode
        const raw = row.original.customerRaw
        if (!code && !raw) {
          return <span className="text-muted-foreground/60">—</span>
        }
        if (!code) {
          return (
            <span className="text-amber-700 dark:text-amber-300" title={`表格原文：${raw}`}>
              {raw}
            </span>
          )
        }
        const title =
          raw && raw.trim().toLowerCase() !== code.trim().toLowerCase()
            ? `表格：${raw}`
            : undefined
        return (
          <span className="font-medium text-foreground" title={title}>
            {code}
          </span>
        )
      },
    },
    {
      accessorKey: "orderDateKey",
      id: "orderDate",
      header: ({ column }: HeaderContext<MailAssistantImportRow, unknown>) => (
        <ColumnHeader icon={CalendarDays} label="订单日期" />
      ),
      size: 130,
      minSize: 110,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{row.original.orderDate}</span>
      ),
    },
    {
      accessorKey: "imported",
      id: "imported",
      header: () => <ColumnHeader icon={CircleCheck} label="导入状态" />,
      size: 120,
      minSize: 100,
      cell: ({ row }) =>
        row.original.imported ? (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" />
            已导入
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-amber-300/80 text-amber-800 dark:text-amber-200 bg-amber-50/80 dark:bg-amber-950/30 font-medium">
            <XCircle className="h-3 w-3" />
            未导入
          </Badge>
        ),
      meta: { alignRight: false },
    },
    {
      accessorKey: "sourceForecast",
      id: "sourceForecast",
      header: () => <ColumnHeader icon={FileSpreadsheet} label="源预报" className="justify-start" />,
      size: 200,
      minSize: 140,
      meta: { alignLeft: true },
      enableSorting: false,
      cell: ({ row }) => {
        const sf = row.original.sourceForecast
        if (!sf || sf.status === "idle") {
          return <span className="text-muted-foreground/60">—</span>
        }
        if (sf.status === "loading") {
          return (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              查找中…
            </span>
          )
        }
        if (sf.status === "not_found") {
          return (
            <span
              className="text-muted-foreground"
              title={sf.resolveReason || "未在邮箱中找到源预报 Excel"}
            >
              暂无
            </span>
          )
        }
        const linkTitle = [
          sf.resolveReason,
          sf.gmailUrl ? `邮件：${sf.gmailUrl}` : null,
        ]
          .filter(Boolean)
          .join("\n")
        return (
          <a
            href={buildForecastFilePageUrl("source", row.original.containerNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 truncate"
            title={linkTitle || sf.label || "新标签页打开邮件 Excel"}
            onClick={(e) => e.stopPropagation()}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{sf.label || "源预报"}</span>
            {sf.aiResolved && (
              <Badge variant="secondary" className="h-5 px-1 text-[10px] shrink-0">AI</Badge>
            )}
          </a>
        )
      },
    },
    {
      accessorKey: "importDraft",
      id: "importDraft",
      header: () => <ColumnHeader icon={FileInput} label="导入预报" className="justify-start" />,
      size: 160,
      minSize: 120,
      meta: { alignLeft: true },
      enableSorting: false,
      cell: ({ row }) => {
        const sf = row.original.sourceForecast
        const draft = row.original.importDraft
        if (sf?.status !== "found") {
          return <span className="text-muted-foreground/50 text-xs">—</span>
        }
        if (draft?.status === "loading") {
          return (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              转换中…
            </span>
          )
        }
        if (!draft?.downloadUrl) {
          return <span className="text-muted-foreground text-xs">待转换</span>
        }
        return (
          <a
            href={buildForecastFilePageUrl("import", row.original.containerNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400 truncate"
            title="新标签页打开导入预报 Excel"
            onClick={(e) => e.stopPropagation()}
          >
            <FileInput className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">导入表</span>
          </a>
        )
      },
    },
  ]
}

export function MailAssistantImportTable({
  rows,
  loading,
  filterSignature,
  onRowSelectionChange,
}: MailAssistantImportTableProps) {
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(DEFAULT_LIST_PAGE_SIZE)

  const handleCopyContainer = React.useCallback(async (containerNumber: string) => {
    try {
      await copyTextToClipboard(containerNumber)
      toast.success(`已复制柜号 ${containerNumber}`)
    } catch {
      toast.error("复制失败，请手动选择柜号复制")
    }
  }, [])

  const columns = React.useMemo(() => buildColumns(handleCopyContainer), [handleCopyContainer])

  React.useEffect(() => {
    setPage(1)
  }, [filterSignature, rows.length])

  return (
    <Card className="border border-border/80 shadow-sm bg-card overflow-visible !py-0 !gap-0">
      <CardContent className="!p-0 [&_thead]:bg-gradient-to-r [&_thead]:from-slate-100 [&_thead]:to-slate-50 [&_thead]:dark:from-slate-900/90 [&_thead]:dark:to-slate-800/80 [&_thead_th]:border-b [&_thead_th]:border-border/70 [&_thead_th]:py-2.5">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          initialSorting={[{ id: "orderDate", desc: false }]}
          sortableColumns={["orderDate", "containerNumber", "imported"]}
          columnLabels={{
            containerNumber: "柜号",
            orderDate: "订单日期",
            imported: "导入状态",
            sourceForecast: "源预报",
            importDraft: "导入预报",
          }}
          enableRowSelection
          getIdValue={getMailAssistantRowId}
          onRowSelectionChange={onRowSelectionChange}
        />
      </CardContent>
    </Card>
  )
}
