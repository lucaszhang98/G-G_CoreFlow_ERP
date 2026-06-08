"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, ExternalLink, FileInput, FileSpreadsheet, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { IMPORT_EDITABLE_SHEET, trimImportEditableRows } from "@/lib/mail-assistant/import-draft-matrix"

type ViewMeta = {
  kind: "source" | "import"
  containerNumber: string
  filename: string
  downloadUrl: string
  gmailUrl?: string
  officeEmbedUrl: string | null
  useOfficeViewer: boolean
  editable?: boolean
  detailRowCount?: number
  fileVersion?: number
}

/** 导入模板关键列（0-based），用于预览时突出明细行 */
const IMPORT_PREVIEW_COLUMNS: Array<{ index: number; label: string }> = [
  { index: 0, label: "订单号" },
  { index: 1, label: "客户代码" },
  { index: 3, label: "操作方式" },
  { index: 4, label: "目的地" },
  { index: 20, label: "送仓地点" },
  { index: 21, label: "性质" },
  { index: 22, label: "数量" },
  { index: 23, label: "体积" },
  { index: 24, label: "FBA" },
  { index: 26, label: "明细备注" },
]

function buildImportPreviewSheet(matrix: unknown[][]): SheetView {
  const header = IMPORT_PREVIEW_COLUMNS.map((c) => c.label)
  const dataRows = matrix.slice(1).filter((row) => {
    const r = row as unknown[]
    const detailLoc = String(r[20] ?? "").trim()
    const qty = String(r[22] ?? "").trim()
    return Boolean(detailLoc || qty)
  })
  return {
    name: "导入明细预览",
    rows: [header, ...dataRows.map((row) => {
      const r = row as unknown[]
      return IMPORT_PREVIEW_COLUMNS.map((c) => String(r[c.index] ?? ""))
    })],
    editable: false,
  }
}

type SheetView = {
  name: string
  rows: string[][]
  editable?: boolean
}

function matrixFromSheet(wb: XLSX.WorkBook, name: string): string[][] {
  const sheet = wb.Sheets[name]
  if (!sheet) return []
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][]
  return matrix.map((row) =>
    (row as unknown[]).map((c) => {
      if (c instanceof Date) return c.toISOString().slice(0, 10)
      return String(c ?? "")
    })
  )
}

export function ForecastFileClient() {
  const searchParams = useSearchParams()
  const kind = searchParams.get("kind")
  const containerNumber = searchParams.get("containerNumber")?.trim().toUpperCase() ?? ""

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [meta, setMeta] = React.useState<ViewMeta | null>(null)
  const [sheets, setSheets] = React.useState<SheetView[]>([])
  const [activeSheet, setActiveSheet] = React.useState(0)
  const [sheetEdits, setSheetEdits] = React.useState<Record<string, string[][]>>({})
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const isImport = kind === "import"
  const isSource = kind === "source"

  const getDisplayRows = React.useCallback(
    (sheet: SheetView): string[][] => {
      if (isImport && sheet.name === IMPORT_EDITABLE_SHEET) {
        const edited = sheetEdits[sheet.name]
        return edited ?? trimImportEditableRows(sheet.rows)
      }
      return sheet.rows
    },
    [isImport, sheetEdits]
  )

  const handleCellChange = (
    sheetName: string,
    rowIndex: number,
    colIndex: number,
    value: string
  ) => {
    setSheetEdits((prev) => {
      const baseSheet = sheets.find((s) => s.name === sheetName)
      const current =
        prev[sheetName] ??
        (sheetName === IMPORT_EDITABLE_SHEET && baseSheet
          ? trimImportEditableRows(baseSheet.rows)
          : baseSheet?.rows ?? [])
      const next = current.map((row, ri) =>
        ri === rowIndex ? row.map((cell, ci) => (ci === colIndex ? value : cell)) : row
      )
      return { ...prev, [sheetName]: next }
    })
    setDirty(true)
  }

  const handleSave = async () => {
    if (!meta || !isImport) return
    const matrix = sheetEdits[IMPORT_EDITABLE_SHEET]
    if (!matrix?.length) {
      toast.error("没有可保存的编辑内容")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/google/workspace/forecast-import-draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          containerNumber: meta.containerNumber,
          rows: matrix,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "保存失败")

      setDirty(false)
      setMeta((m) =>
        m
          ? {
              ...m,
              detailRowCount: json.detailRowCount,
              fileVersion: json.fileVersion,
              downloadUrl: `/api/google/workspace/forecast-import-draft?containerNumber=${encodeURIComponent(m.containerNumber)}&v=${json.fileVersion}`,
            }
          : m
      )

      const templateSheet = sheets.find((s) => s.name === IMPORT_EDITABLE_SHEET)
      if (templateSheet) {
        const savedRows = trimImportEditableRows(matrix)
        setSheets((prev) =>
          prev.map((s) => {
            if (s.name === IMPORT_EDITABLE_SHEET) {
              return { ...s, rows: savedRows }
            }
            if (s.name === "导入明细预览") {
              return buildImportPreviewSheet(savedRows as unknown[][])
            }
            return s
          })
        )
        setSheetEdits((prev) => ({ ...prev, [IMPORT_EDITABLE_SHEET]: savedRows }))
      }

      toast.success(`已保存，共 ${json.detailRowCount} 行明细`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  React.useEffect(() => {
    if ((kind !== "source" && kind !== "import") || !containerNumber) {
      setError("参数无效")
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      try {
        const params = new URLSearchParams({
          kind: kind as string,
          containerNumber,
        })
        const metaRes = await fetch(`/api/google/workspace/forecast-file-view?${params}`)
        const metaJson = await metaRes.json()
        if (!metaRes.ok) throw new Error(metaJson.error || "加载失败")
        if (cancelled) return
        setMeta(metaJson)

        const fileRes = await fetch(metaJson.downloadUrl, { cache: "no-store" })
        if (!fileRes.ok) throw new Error("无法读取 Excel 原文件")
        const buf = await fileRes.arrayBuffer()
        const wb = XLSX.read(buf, { type: "array", cellDates: true })

        const parsed: SheetView[] = wb.SheetNames.map((name) => {
          const rows = matrixFromSheet(wb, name)
          return {
            name,
            rows,
            editable: kind === "import" && name === IMPORT_EDITABLE_SHEET,
          }
        })

        const templateSheet = parsed.find((s) => s.name === IMPORT_EDITABLE_SHEET)
        const templateMatrix = templateSheet?.rows ?? parsed[0]?.rows ?? []

        const displaySheets =
          kind === "import" && templateMatrix.length
            ? [buildImportPreviewSheet(templateMatrix as unknown[][]), ...parsed]
            : parsed

        const defaultActive =
          kind === "import"
            ? Math.max(
                0,
                displaySheets.findIndex((s) => s.name === IMPORT_EDITABLE_SHEET)
              )
            : 0

        if (!cancelled) {
          setSheets(displaySheets)
          setActiveSheet(defaultActive >= 0 ? defaultActive : 0)
          setSheetEdits({})
          setDirty(false)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [kind, containerNumber])

  const sheet = sheets[activeSheet]
  const displayRows = sheet ? getDisplayRows(sheet) : []
  const canEdit = Boolean(isImport && sheet?.editable && meta?.editable !== false)

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在打开 Excel…
      </div>
    )
  }

  if (error || !meta) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-muted-foreground">
        <p>{error ?? "无法打开文件"}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings/mail-assistant">返回邮件助手</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/settings/mail-assistant">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              返回
            </Link>
          </Button>
          <div className="inline-flex items-center gap-2 text-sm font-semibold">
            {isSource ? (
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            ) : (
              <FileInput className="h-4 w-4 text-indigo-600" />
            )}
            {isSource ? "源预报 Excel" : "导入预报 Excel"}
            <Badge variant="outline" className="font-mono text-xs">
              {meta.containerNumber}
            </Badge>
            {!isSource && meta.detailRowCount != null && meta.detailRowCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {meta.detailRowCount} 行明细
              </Badge>
            )}
            {canEdit && dirty && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                未保存
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-[320px]">{meta.filename}</span>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button
              size="sm"
              disabled={!dirty || saving}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              保存
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={meta.downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download className="mr-1.5 h-4 w-4" />
              下载
            </a>
          </Button>
          {isSource && meta.gmailUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={meta.gmailUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Gmail 邮件
              </a>
            </Button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
          {canEdit && (
            <p className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground shrink-0">
              在「{IMPORT_EDITABLE_SHEET}」工作表中直接修改单元格，完成后点击「保存」写回数据库。
            </p>
          )}
          {sheets.length > 1 && (
            <div className="flex flex-wrap gap-2 border-b px-4 py-2 shrink-0">
              {sheets.map((s, idx) => (
                <Button
                  key={s.name}
                  type="button"
                  size="sm"
                  variant={idx === activeSheet ? "default" : "outline"}
                  onClick={() => setActiveSheet(idx)}
                >
                  {s.name}
                  {s.editable && (
                    <span className="ml-1 text-[10px] opacity-70">可编辑</span>
                  )}
                </Button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-auto p-4 bg-muted/20">
            {sheet ? (
              <div className="overflow-x-auto rounded border bg-card shadow-sm">
                <table className="min-w-full border-collapse text-xs font-mono">
                  <tbody>
                    {displayRows.map((row, ri) => (
                      <tr
                        key={ri}
                        className={
                          ri === 0
                            ? "bg-muted/70 font-semibold sticky top-0 z-10"
                            : "odd:bg-muted/10"
                        }
                      >
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="border border-border/60 px-0 py-0 whitespace-pre align-top min-w-[72px] max-w-[360px]"
                          >
                            {canEdit && ri > 0 ? (
                              <input
                                type="text"
                                value={cell}
                                onChange={(e) =>
                                  handleCellChange(sheet.name, ri, ci, e.target.value)
                                }
                                className="w-full min-w-[72px] bg-transparent px-2 py-1 outline-none focus:bg-background focus:ring-1 focus:ring-ring"
                              />
                            ) : (
                              <span className="block px-2 py-1">{cell}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground">文件为空</p>
            )}
          </div>
        </div>
    </div>
  )
}
