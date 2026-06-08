"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { SearchModule } from "@/components/crud/search-module"
import {
  MailAssistantImportTable,
  type MailAssistantImportRow,
  type SourceForecastCell,
} from "./mail-assistant-import-table"
import { MailAssistantFeedbackSheet } from "./mail-assistant-feedback-sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { copyTextToClipboard } from "@/lib/utils/copy-to-clipboard"
import type { FilterFieldConfig } from "@/lib/crud/types"
import {
  Loader2,
  Link2,
  Unlink,
  ChevronDown,
  RefreshCw,
  CheckCircle2,
  FileSpreadsheet,
  Cloud,
  Package,
  Copy,
  BookOpen,
  AlertTriangle,
  Headphones,
  FileSearch,
  FileInput,
  Sparkles,
  MessageSquareWarning,
  FolderInput,
} from "lucide-react"
import { toast } from "sonner"
import { isMailAssistantAdmin } from "@/lib/mail-assistant/mail-assistant-permissions"

const MAIL_FILTER_FIELDS: FilterFieldConfig[] = [
  {
    field: "orderDate",
    label: "订单日期",
    type: "dateRange",
  },
  {
    field: "imported",
    label: "已导入",
    type: "select",
    options: [
      { label: "全部", value: "__all__" },
      { label: "已导入", value: "yes" },
      { label: "未导入", value: "no" },
    ],
  },
]

const EMPTY_FILTER_VALUES: Record<string, string> = {
  imported: "__all__",
}

type ForecastAiStatus = {
  configured: boolean
  provider: "gemini" | null
  model: string | null
  mode: "ai_first" | "rules_only"
}

type ConnectionStatus = {
  connected: boolean
  email: string | null
  oauthConfigured: boolean
  redirectUri: string
  currentOrigin: string | null
  authMode: string
  forecastAi?: ForecastAiStatus
}

type Yg2025ImportCheck = {
  rows: MailAssistantImportRow[]
  total: number
  importedCount: number
  notImportedCount: number
  sheetName: string
  spreadsheetTitle: string
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  accent: "blue" | "emerald" | "amber"
}) {
  const accents = {
    blue: "from-blue-500 to-indigo-600",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
  }
  return (
    <Card className="border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      <div className={cn("h-1 bg-gradient-to-r", accents[accent])} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={cn("p-2 rounded-lg bg-gradient-to-br text-white shadow-sm", accents[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}

type MailAssistantClientProps = {
  userRole?: string | null
}

export function MailAssistantClient({ userRole }: MailAssistantClientProps) {
  const searchParams = useSearchParams()
  const isAdmin = isMailAssistantAdmin(userRole)
  const [status, setStatus] = React.useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [disconnecting, setDisconnecting] = React.useState(false)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [importCheck, setImportCheck] = React.useState<Yg2025ImportCheck | null>(null)
  const [loadingImportCheck, setLoadingImportCheck] = React.useState(false)
  const [containerSearch, setContainerSearch] = React.useState("")
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>(EMPTY_FILTER_VALUES)
  const [selectedRows, setSelectedRows] = React.useState<MailAssistantImportRow[]>([])
  const [forecastByContainer, setForecastByContainer] = React.useState<
    Record<string, SourceForecastCell>
  >({})
  const [findingForecast, setFindingForecast] = React.useState(false)
  const [convertingImport, setConvertingImport] = React.useState(false)
  const [testingAi, setTestingAi] = React.useState(false)
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)
  const [importingToOrders, setImportingToOrders] = React.useState(false)
  const [importOrderErrors, setImportOrderErrors] = React.useState<
    Array<{ row: number; field?: string; message: string }> | null
  >(null)
  const loadStatus = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/google/workspace/status")
      if (!res.ok) throw new Error("获取连接状态失败")
      const data = (await res.json()) as ConnectionStatus
      setStatus(data)
    } catch (error) {
      console.error(error)
      toast.error("无法加载连接状态")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadStatus()
  }, [loadStatus])

  React.useEffect(() => {
    const googleResult = searchParams.get("google")
    if (googleResult === "connected") {
      toast.success("Google 账号已连接")
      loadStatus()
    } else if (googleResult === "error") {
      toast.error(`Google 授权失败：${searchParams.get("reason") || "unknown"}`)
    }
  }, [searchParams, loadStatus])

  const loadImportCheck = React.useCallback(async () => {
    setLoadingImportCheck(true)
    try {
      const res = await fetch("/api/google/workspace/yg2025-import-check")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "加载失败")
      setImportCheck(data as Yg2025ImportCheck)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "加载清单失败")
    } finally {
      setLoadingImportCheck(false)
    }
  }, [])

  React.useEffect(() => {
    if (status?.connected && !importCheck && !loadingImportCheck) {
      loadImportCheck()
    }
  }, [status?.connected, importCheck, loadingImportCheck, loadImportCheck])

  const loadForecastCache = React.useCallback(async (containerNumbers: string[]) => {
    const unique = [...new Set(containerNumbers.map((c) => c.trim().toUpperCase()).filter(Boolean))]
    if (unique.length === 0) return

    try {
      const res = await fetch("/api/google/workspace/forecast-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerNumbers: unique }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "加载预报缓存失败")

      const forecasts = (data.forecasts ?? []) as Array<{
        containerNumber: string
        status: "found" | "not_found"
        label?: string
        downloadUrl?: string
        gmailUrl?: string
        messageId?: string
        attachmentId?: string
        aiResolved?: boolean
        resolveReason?: string
        importDraftDownloadUrl?: string
      }>

      setForecastByContainer((prev) => {
        const next = { ...prev }
        for (const f of forecasts) {
          const cn = f.containerNumber
          if (f.status === "found") {
            next[cn] = {
              status: "found",
              label: f.label,
              downloadUrl: f.downloadUrl,
              gmailUrl: f.gmailUrl,
              messageId: f.messageId,
              attachmentId: f.attachmentId,
              aiResolved: f.aiResolved,
              resolveReason: f.resolveReason,
              importDraftDownloadUrl: f.importDraftDownloadUrl,
            }
          } else {
            next[cn] = {
              status: "not_found",
              resolveReason: f.resolveReason,
            }
          }
        }
        return next
      })
    } catch (error) {
      console.error("loadForecastCache:", error)
    }
  }, [])

  React.useEffect(() => {
    if (!importCheck?.rows.length || !status?.connected) return
    void loadForecastCache(importCheck.rows.map((r) => r.containerNumber))
  }, [importCheck, status?.connected, loadForecastCache])

  const filteredImportRows = React.useMemo(() => {
    if (!importCheck) return []
    let list = importCheck.rows

    const q = containerSearch.trim().toUpperCase()
    if (q) {
      list = list.filter((r) => r.containerNumber.toUpperCase().includes(q))
    }

    const from = filterValues.orderDate_from?.trim()
    const to = filterValues.orderDate_to?.trim()
    if (from) list = list.filter((r) => r.orderDateKey >= from)
    if (to) list = list.filter((r) => r.orderDateKey <= to)

    const importedFilter = filterValues.imported
    if (importedFilter === "yes") list = list.filter((r) => r.imported)
    if (importedFilter === "no") list = list.filter((r) => !r.imported)

    return [...list].sort((a, b) => a.orderDateKey.localeCompare(b.orderDateKey))
  }, [importCheck, containerSearch, filterValues])

  const tableFilterSignature = React.useMemo(
    () => `${containerSearch}|${filterValues.orderDate_from ?? ""}|${filterValues.orderDate_to ?? ""}|${filterValues.imported}`,
    [containerSearch, filterValues]
  )

  React.useEffect(() => {
    setSelectedRows([])
  }, [tableFilterSignature])

  const selectedWithImportDraft = React.useMemo(
    () =>
      selectedRows.filter((row) => {
        const sf = forecastByContainer[row.containerNumber]
        return (
          sf?.status === "found" &&
          Boolean(sf.importDraftDownloadUrl) &&
          !sf.importDraftConverting
        )
      }),
    [selectedRows, forecastByContainer]
  )

  const displayRows = React.useMemo(
    () =>
      filteredImportRows.map((row) => {
        const sf = forecastByContainer[row.containerNumber] ?? { status: "idle" as const }
        const importDraftUrl = sf.importDraftDownloadUrl
        let importDraft: MailAssistantImportRow["importDraft"] = { status: "idle" }
        if (sf.status === "found") {
          if (sf.importDraftConverting) {
            importDraft = { status: "loading" }
          } else if (importDraftUrl) {
            importDraft = { status: "ready", downloadUrl: importDraftUrl }
          }
        }
        return {
          ...row,
          sourceForecast: sf,
          importDraft,
        }
      }),
    [filteredImportRows, forecastByContainer]
  )

  const resolveContainerList = React.useCallback(
    (mode: "selected" | "filtered" | "notImported", actionLabel: string) => {
      let list: string[] = []
      if (mode === "selected") {
        if (selectedRows.length === 0) {
          toast.error(`请先勾选要${actionLabel}的记录`)
          return null
        }
        list = selectedRows.map((r) => r.containerNumber)
      } else if (mode === "filtered") {
        list = filteredImportRows.map((r) => r.containerNumber)
      } else {
        list = filteredImportRows.filter((r) => !r.imported).map((r) => r.containerNumber)
      }

      const unique = [...new Set(list.map((c) => c.trim().toUpperCase()).filter(Boolean))]
      if (unique.length === 0) {
        toast.error(`当前没有可${actionLabel}的柜号`)
        return null
      }
      if (unique.length > 100) {
        toast.error(`单次最多处理 100 个柜号，请缩小筛选范围`)
        return null
      }
      return unique
    },
    [selectedRows, filteredImportRows]
  )

  const handleFindForecast = React.useCallback(
    async (mode: "selected" | "filtered" | "notImported") => {
      const unique = resolveContainerList(mode, "查找")
      if (!unique) return

      if (!status?.forecastAi?.configured) {
        toast.warning("未配置 GEMINI_API_KEY，将仅用规则匹配；配置后重启 dev 服务可启用 AI")
      }

      setFindingForecast(true)
      setForecastByContainer((prev) => {
        const next = { ...prev }
        for (const cn of unique) {
          next[cn] = { ...prev[cn], status: "loading" }
        }
        return next
      })

      try {
        const chunks: string[][] = []
        for (let i = 0; i < unique.length; i += 50) {
          chunks.push(unique.slice(i, i + 50))
        }

        const allResults: Array<{
          containerNumber: string
          status: "found" | "not_found"
          resolveReason?: string
          sourceForecast: {
            label: string
            downloadUrl: string
            gmailUrl: string
            messageId: string
            attachmentId: string
            aiResolved: boolean
            resolveReason: string
          } | null
        }> = []

        for (const chunk of chunks) {
          const res = await fetch("/api/google/workspace/forecast-lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ containerNumbers: chunk }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || "查找失败")
          allResults.push(...(data.results ?? []))
        }

        setForecastByContainer((prev) => {
          const next = { ...prev }
          for (const item of allResults) {
            const cn = item.containerNumber
            const kept = prev[cn]
            if (item.status === "found" && item.sourceForecast) {
              next[cn] = {
                status: "found",
                label: item.sourceForecast.label,
                downloadUrl: item.sourceForecast.downloadUrl,
                gmailUrl: item.sourceForecast.gmailUrl,
                messageId: item.sourceForecast.messageId,
                attachmentId: item.sourceForecast.attachmentId,
                aiResolved: item.sourceForecast.aiResolved,
                resolveReason: item.sourceForecast.resolveReason,
                importDraftDownloadUrl: kept?.importDraftDownloadUrl,
              }
            } else {
              next[cn] = {
                status: "not_found",
                resolveReason: item.resolveReason,
              }
            }
          }
          return next
        })

        const found = allResults.filter((r) => r.status === "found").length
        const aiLabel = status?.forecastAi?.configured ? "（AI 优先）" : "（仅规则）"
        toast.success(`找预报完成${aiLabel}：${found}/${unique.length} 个已定位源 Excel`)
      } catch (error) {
        console.error(error)
        toast.error(error instanceof Error ? error.message : "找预报失败")
        setForecastByContainer((prev) => {
          const next = { ...prev }
          for (const cn of unique) {
            if (next[cn]?.status === "loading") {
              next[cn] = { ...prev[cn], status: prev[cn]?.label ? "found" : "idle" }
            }
          }
          return next
        })
      } finally {
        setFindingForecast(false)
      }
    },
    [resolveContainerList, status?.forecastAi?.configured]
  )

  const handleConvertImportDraft = React.useCallback(
    async (mode: "selected" | "filtered" | "notImported") => {
      const unique = resolveContainerList(mode, "转换")
      if (!unique) return

      const withSource = unique.filter((cn) => forecastByContainer[cn]?.status === "found")
      if (withSource.length === 0) {
        toast.error("所选柜号尚无源预报，请先执行「找预报」")
        return
      }

      setConvertingImport(true)
      setForecastByContainer((prev) => {
        const next = { ...prev }
        for (const cn of withSource) {
          next[cn] = { ...prev[cn], importDraftConverting: true }
        }
        return next
      })

      try {
        const chunks: string[][] = []
        for (let i = 0; i < withSource.length; i += 50) {
          chunks.push(withSource.slice(i, i + 50))
        }

        const allResults: Array<{
          containerNumber: string
          status: "converted" | "skipped" | "failed"
          importDraftDownloadUrl?: string
          detailRowCount?: number
          warnings?: string
          error?: string
        }> = []

        for (const chunk of chunks) {
          const res = await fetch("/api/google/workspace/forecast-import-convert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ containerNumbers: chunk }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || "转换失败")
          allResults.push(...(data.results ?? []))
        }

        setForecastByContainer((prev) => {
          const next = { ...prev }
          for (const item of allResults) {
            const cn = item.containerNumber
            const kept = prev[cn]
            if (!kept) continue
            next[cn] = {
              ...kept,
              importDraftConverting: false,
              ...(item.status === "converted" && item.importDraftDownloadUrl
                ? { importDraftDownloadUrl: item.importDraftDownloadUrl }
                : {}),
            }
          }
          return next
        })

        const converted = allResults.filter((r) => r.status === "converted").length
        const failed = allResults.filter((r) => r.status === "failed").length
        const skipped = allResults.filter((r) => r.status === "skipped").length
        if (failed > 0) {
          toast.warning(`转换完成：成功 ${converted}，失败 ${failed}，跳过 ${skipped}`)
        } else {
          toast.success(`转换源预报完成：${converted}/${withSource.length} 个已生成导入 Excel`)
        }
      } catch (error) {
        console.error(error)
        toast.error(error instanceof Error ? error.message : "转换源预报失败")
        setForecastByContainer((prev) => {
          const next = { ...prev }
          for (const cn of withSource) {
            if (next[cn]) next[cn] = { ...next[cn], importDraftConverting: false }
          }
          return next
        })
      } finally {
        setConvertingImport(false)
      }
    },
    [resolveContainerList, forecastByContainer]
  )

  const handleImportSelectedToOrders = React.useCallback(async () => {
    if (selectedRows.length === 0) {
      toast.error("请先勾选要导入的记录")
      return
    }

    const eligible = selectedWithImportDraft.map((r) => r.containerNumber)
    if (eligible.length === 0) {
      toast.error("勾选的行中没有已生成导入预报的柜号，请先执行「转换源预报」")
      return
    }

    const skippedCount = selectedRows.length - eligible.length
    if (skippedCount > 0) {
      toast.warning(`${skippedCount} 个勾选行尚无导入预报，将跳过`)
    }

    setImportingToOrders(true)
    setImportOrderErrors(null)

    try {
      const res = await fetch("/api/google/workspace/forecast-import-to-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerNumbers: eligible }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        const errors = (data.errors ?? []) as Array<{
          row: number
          field?: string
          message: string
        }>
        setImportOrderErrors(errors.length > 0 ? errors : [{ row: 0, message: data.error || data.message || "导入失败" }])
        toast.error(data.message || data.error || "导入订单失败，请查看下方错误详情")
        return
      }

      const skipped = (data.skipped ?? []) as Array<{ containerNumber: string; reason: string }>
      if (skipped.length > 0) {
        toast.warning(`已导入 ${data.successCount ?? data.imported ?? 0} 条明细；${skipped.length} 个柜号被跳过`)
      } else {
        toast.success(data.message || `已成功导入 ${data.successCount ?? data.imported ?? 0} 条订单明细`)
      }

      await loadImportCheck()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "导入订单失败")
    } finally {
      setImportingToOrders(false)
    }
  }, [selectedRows, selectedWithImportDraft, loadImportCheck])

  const handleTestForecastAi = React.useCallback(async () => {
    setTestingAi(true)
    try {
      const res = await fetch("/api/google/workspace/forecast-ai-test", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "AI 测试失败")
      toast.success(data.message || "AI 连接正常")
      await loadStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 测试失败")
    } finally {
      setTestingAi(false)
    }
  }, [loadStatus])

  const handleCopyConnectedEmail = React.useCallback(async () => {
    const email = status?.email?.trim()
    if (!email) {
      toast.error("当前未连接 Google 账号")
      return
    }
    try {
      await copyTextToClipboard(email)
      toast.success("已复制绑定邮箱")
    } catch {
      toast.error("复制失败，请手动选择邮箱地址")
    }
  }, [status?.email])

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch("/api/google/workspace/disconnect", { method: "POST" })
      if (!res.ok) throw new Error("断开连接失败")
      toast.success("已断开 Google 连接")
      setImportCheck(null)
      await loadStatus()
    } catch {
      toast.error("断开连接失败")
    } finally {
      setDisconnecting(false)
    }
  }

  const connected = Boolean(status?.connected)
  const oauthReady = Boolean(status?.oauthConfigured)
  const aiReady = Boolean(status?.forecastAi?.configured)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-16 px-2 sm:px-4 lg:px-6">
      {/* 页头 */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/8 via-indigo-600/8 to-violet-600/8 rounded-3xl blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-6 rounded-2xl border border-border/60 bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/20 dark:via-blue-950/20 dark:to-indigo-950/10 shadow-lg">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              邮件助手
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
              同步 OAK 码头调度表 YG2025，对比订单管理系统导入状态
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {loading ? (
              <Badge variant="secondary" className="px-3 py-1.5">
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                检查连接…
              </Badge>
            ) : connected ? (
              <button
                type="button"
                onClick={handleCopyConnectedEmail}
                title="点击复制绑定邮箱"
                className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <span>{status?.email || "已连接"}</span>
                <Copy className="h-3.5 w-3.5 ml-1.5 opacity-80" />
              </button>
            ) : oauthReady ? (
              <Badge variant="secondary" className="px-3 py-1.5">未连接 Google</Badge>
            ) : (
              <Badge variant="destructive" className="px-3 py-1.5">OAuth 未配置</Badge>
            )}
            {!connected && oauthReady && (
              <Button size="sm" onClick={() => { window.location.href = "/api/google/workspace/auth" }}>
                <Link2 className="h-4 w-4 mr-1.5" />
                连接账号
              </Button>
            )}
            {connected && isAdmin && (
              <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4 mr-1.5" />}
                断开
              </Button>
            )}
            {!loading && aiReady ? (
              <Badge className="px-3 py-1.5 bg-violet-600 hover:bg-violet-600 gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Gemini {status?.forecastAi?.model}
              </Badge>
            ) : !loading ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={handleTestForecastAi}
                disabled={testingAi}
                title="需在 .env.local 配置 GEMINI_API_KEY 后重启服务"
              >
                {testingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                配置 AI
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="清单总数（2026.04+）"
          value={importCheck?.total ?? "—"}
          icon={FileSpreadsheet}
          accent="blue"
        />
        <StatCard
          label="已导入"
          value={importCheck?.importedCount ?? "—"}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="未导入"
          value={importCheck?.notImportedCount ?? "—"}
          icon={Package}
          accent="amber"
        />
      </div>

      {/* 搜索 + 表格 */}
      <div className="space-y-3">
        {connected && importCheck && (
          <SearchModule
            searchPlaceholder="按柜号模糊搜索…"
            searchValue={containerSearch}
            onSearchChange={setContainerSearch}
            total={filteredImportRows.length}
            filterFields={MAIL_FILTER_FIELDS}
            filterValues={filterValues}
            onFilterChange={(field, value) => {
              setFilterValues((prev) => ({
                ...prev,
                [field]: value == null ? "" : String(value),
              }))
            }}
            onClearFilters={() => setFilterValues({ ...EMPTY_FILTER_VALUES })}
            advancedSearchFields={[]}
            advancedSearchOpen={false}
            onAdvancedSearchOpenChange={() => {}}
            advancedSearchValues={{}}
            advancedSearchLogic="AND"
            onAdvancedSearchChange={() => {}}
            onAdvancedSearchLogicChange={() => {}}
            onAdvancedSearch={() => {}}
            onResetAdvancedSearch={() => {}}
            extraFilterContent={
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={loadImportCheck}
                disabled={loadingImportCheck}
              >
                <RefreshCw className={cn("h-4 w-4 mr-1.5", loadingImportCheck && "animate-spin")} />
                刷新数据
              </Button>
            }
          />
        )}

        {connected && importCheck && (
          <div className="flex flex-col gap-2 w-full px-0.5">
            {selectedRows.length > 0 && (
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                已选择 <span className="font-bold">{selectedRows.length}</span> 条
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                className="h-9 min-w-[100px]"
                onClick={() => {
                  if (selectedRows.length === 0) {
                    toast.error("请先勾选要纠错的记录")
                    return
                  }
                  setFeedbackOpen(true)
                }}
              >
                <MessageSquareWarning className="h-4 w-4 mr-1.5" />
                预报纠错
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 min-w-[100px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    disabled={findingForecast}
                  >
                    {findingForecast ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <FileSearch className="h-4 w-4 mr-1.5" />
                    )}
                    找预报
                    <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>
                    {aiReady ? "AI 审阅邮箱 Excel 附件" : "规则模式搜索 Excel"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleFindForecast("selected")}>
                    查找勾选柜号
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFindForecast("notImported")}>
                    查找未导入（当前筛选）
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFindForecast("filtered")}>
                    查找当前筛选全部
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="h-9 min-w-[100px]" disabled={convertingImport}>
                    {convertingImport ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <FileInput className="h-4 w-4 mr-1.5" />
                    )}
                    转换源预报
                    <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>源预报 → 订单导入 Excel</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleConvertImportDraft("selected")}>
                    转换勾选柜号
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleConvertImportDraft("notImported")}>
                    转换未导入（当前筛选）
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleConvertImportDraft("filtered")}>
                    转换当前筛选全部
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="default"
                size="sm"
                className="h-9 min-w-[100px] bg-emerald-600 hover:bg-emerald-700"
                disabled={importingToOrders || selectedWithImportDraft.length === 0}
                onClick={() => void handleImportSelectedToOrders()}
                title={
                  selectedWithImportDraft.length === 0
                    ? "请勾选已有导入预报的行"
                    : `将 ${selectedWithImportDraft.length} 个柜号写入订单管理`
                }
              >
                {importingToOrders ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <FolderInput className="h-4 w-4 mr-1.5" />
                )}
                导入到订单
                {selectedWithImportDraft.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] bg-white/20 text-white">
                    {selectedWithImportDraft.length}
                  </Badge>
                )}
              </Button>
              {selectedRows.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 min-w-[100px]"
                  onClick={() => setSelectedRows([])}
                >
                  取消选择
                </Button>
              )}
            </div>
          </div>
        )}

        {!connected && (
          <Card className="border border-border shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Cloud className="h-12 w-12 mb-4 opacity-40" />
              <p className="font-medium">请先连接 Google 账号</p>
            </CardContent>
          </Card>
        )}

        {connected && loadingImportCheck && !importCheck && (
          <Card className="border border-border shadow-sm">
            <CardContent className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              正在加载清单…
            </CardContent>
          </Card>
        )}

        {importOrderErrors && importOrderErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>导入订单失败</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                {importOrderErrors.slice(0, 8).map((err, idx) => (
                  <li key={`${err.row}-${idx}`}>
                    {err.row > 0 ? `第 ${err.row} 行` : "系统"}
                    {err.field ? ` · ${err.field}` : ""}：{err.message}
                  </li>
                ))}
              </ul>
              {importOrderErrors.length > 8 && (
                <p className="mt-2 text-xs opacity-80">另有 {importOrderErrors.length - 8} 条错误未显示</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-8"
                onClick={() => setImportOrderErrors(null)}
              >
                关闭
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {connected && importCheck && (
          <MailAssistantImportTable
            rows={displayRows}
            loading={loadingImportCheck}
            filterSignature={tableFilterSignature}
            onRowSelectionChange={setSelectedRows}
          />
        )}
      </div>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Card className="border border-border/60 shadow-sm">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/40 transition-colors"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                使用说明与技术支持
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", settingsOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-6 space-y-6 text-sm leading-relaxed text-muted-foreground">
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">一、功能说明</h3>
                <p>
                  本页面用于读取公司 Google 表格「OAK码头调度 LIS2024」中的 <strong className="text-foreground">YG2025</strong> 工作表，
                  并与 ERP 订单管理系统自动比对，标注各柜号是否已录入系统。适用于调度与订单录入岗位的日常工作核对。
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">二、日常使用步骤</h3>
                <ol className="list-decimal list-inside space-y-1.5 pl-1">
                  <li>进入 <strong className="text-foreground">系统工具 → 邮件助手</strong>。</li>
                  <li>确认页头显示绿色「已连接」及绑定邮箱（正式环境为 <strong className="text-foreground">wenyang@ggtransport.in</strong>）。</li>
                  <li>点击 <strong className="text-foreground">刷新数据</strong>，获取表格最新内容（数据不会自动更新，需手动刷新）。</li>
                  <li>查看顶部统计卡片，了解清单总数、已导入与未导入数量。</li>
                  <li>使用搜索与筛选：按柜号模糊搜索、按订单日期范围筛选、按导入状态筛选。</li>
                  <li>对未导入记录：可悬停柜号行点击复制图标，再到订单管理模块补录。</li>
                  <li>补录完成后，返回本页再次刷新，确认状态已变为「已导入」。</li>
                  <li><strong className="text-foreground">找预报</strong>：在 Gmail 中定位源 Excel，并保存「源预报」链接；<strong className="text-foreground">转换源预报</strong>：将已找到的源预报转为订单导入 Excel 并保存「导入预报」链接。两步结果均写入数据库，刷新页面不会丢失。</li>
                  <li>勾选已有「导入预报」的行，点击 <strong className="text-foreground">导入到订单</strong>，系统会合并导入表并写入订单管理（与订单模块批量导入相同校验规则）。</li>
                  <li>对仍显示「暂无」的柜号，系统每 <strong className="text-foreground">12 小时</strong> 自动在邮箱中重新查找一次（无需人工操作）。</li>
                  <li><strong className="text-foreground">AI 越用越准</strong>：找预报错了可用「预报纠错」反馈；导入预报在预览页改完点保存后，系统会自动对比系统版与同事改后版并记入学习样例，无需额外填表。</li>
                </ol>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">三、「已导入」判定规则</h3>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>仅展示 <strong className="text-foreground">2026 年 4 月 1 日及以后</strong> 的订单记录。</li>
                  <li>柜号与 ERP 订单号一致，且订单日期相差不超过 <strong className="text-foreground">60 天</strong>（前后约两个月），标记为「已导入」。</li>
                  <li>状态为 <strong className="text-foreground">已取消</strong> 或 <strong className="text-foreground">完成留档</strong> 的订单不计入比对，仍视为「未导入」。</li>
                  <li>若柜号已录入但日期相差较大，系统仍会显示「未导入」，请核对订单日期是否正确。</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">四、操作注意事项</h3>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>请勿随意点击 <strong className="text-foreground">断开</strong>。断开将影响本系统读取 Google 表格，需重新授权。</li>
                  <li>统计卡片显示的是全量数据；表格与搜索栏旁的数量受当前筛选条件影响。</li>
                  <li>首次在正式环境使用，若提示未连接，请点击 <strong className="text-foreground">连接账号</strong>，使用公司 Google 账号完成一次性授权。</li>
                  <li>Google 账号密码变更或安全策略调整后，可能需要重新连接。</li>
                </ul>
              </section>

              <section className="space-y-2 rounded-lg border border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4">
                <h3 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  五、需联系信息技术部门的情况
                </h3>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>页面显示「OAuth 未配置」或点击连接后跳转报错。</li>
                  <li>已连接状态下刷新数据失败，多次重试仍无法加载。</li>
                  <li>Google 表格结构调整（列位置变更、工作表改名或删除）。</li>
                  <li>绑定邮箱需更换，或多人无法共用当前授权。</li>
                  <li>柜号确认已在 ERP 录入、日期也正确，但长期显示「未导入」。</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
                  <Headphones className="h-4 w-4 text-primary" />
                  六、无需联系信息技术部门的情况
                </h3>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>个别柜号确实尚未在订单管理录入 — 按业务流程补录即可。</li>
                  <li>刷新后数量变化 — 源表格数据更新所致，属正常现象。</li>
                  <li>筛选后列表变少 — 筛选条件生效，清除筛选即可恢复。</li>
                </ul>
              </section>

              <section className="space-y-2 rounded-lg border bg-muted/30 p-4 text-xs">
                <h3 className="text-sm font-semibold text-foreground">正式环境技术说明（信息技术部门参考）</h3>
                <p>Google OAuth 授权由信息技术部门在 Google Cloud 与 ERP 正式环境一次性配置完成，操作人员无需自行申请 API 密钥。</p>
                <p className="pt-1">
                  当前系统状态：OAuth {oauthReady ? "已配置" : "未配置"}
                  {connected && status?.email ? ` · 已绑定 ${status.email}` : ""}
                </p>
                <p>正式环境授权回调地址须与 ERP 域名一致，由开发人员在 Google Cloud 控制台与部署平台中维护。操作人员仅需使用公司账号完成浏览器授权。</p>
                <p className="pt-1">
                  源预报持久化表：<code className="text-foreground">mail_container_forecast</code>。
                  定时补查（每 12 小时）：<code className="text-foreground">GET /api/cron/mail-forecast-refresh</code>，
                  采用小批量（默认每批 8 个柜号）并在单次请求超时前自动链式续跑，避免 Netlify 函数超时。
                  需在 Netlify Scheduled Functions 或同类调度中配置，并设置 <code className="text-foreground">CRON_SECRET</code>、
                  <code className="text-foreground">ENABLE_CRON_ENV=production</code>、
                  <code className="text-foreground">NEXT_PUBLIC_APP_URL</code>（用于自动续跑）。
                </p>
              </section>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <MailAssistantFeedbackSheet
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        rows={selectedRows}
      />

    </div>
  )
}
