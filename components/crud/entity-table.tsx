/**
 * 通用实体列表组件
 */

"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { Plus, Trash2, Edit, CheckCircle, XCircle, Upload } from "lucide-react"
import { DataTable, type InlineEditColumnWidthHint } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { createStandardTableConfig } from "@/lib/table/utils"
import { ClickableColumnConfig } from "@/lib/table/config"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EntityConfig, FieldConfig } from "@/lib/crud/types"
import { toast } from "sonner"
import { EntityForm } from "./entity-form"
import { filterAuditFields, getIdField as getConfigIdField } from "@/lib/crud/constants"
import { autoFormatDateField, formatDateDisplay, formatDateTimeDisplay } from "@/lib/utils/date-format"
import { SearchModule } from "./search-module"
import { InlineEditCell } from "./inline-edit-cell"
import { LocationSelect } from "@/components/ui/location-select"
import { enhanceConfigWithSearchFields } from "@/lib/crud/search-config-generator"
import { FuzzySearchSelect, FuzzySearchOption } from "@/components/ui/fuzzy-search-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** 未传 extraListParams 时使用同一引用。默认写 `= {}` 会在每次渲染新建对象，使 fetchData / URL 同步的依赖变化 → 无限请求 + 地址栏不停 replace（列表「跳」、数据被 Abort 覆盖）。 */
const EMPTY_EXTRA_LIST_PARAMS: Record<string, string> = {}

/** 非编辑态：占满单元格可点区域，避免必须对准文字才能进入行内编辑 */
function inlineEditDisplayHitAreaClass(fieldConfig: FieldConfig): string {
  const alignEnd = fieldConfig.type === 'number' || fieldConfig.type === 'currency'
  return cn(
    'cursor-pointer -mx-0.5 min-h-8 h-full min-w-0 w-full self-stretch rounded-sm px-0.5',
    'flex items-center hover:bg-muted/40',
    alignEnd ? 'justify-end' : 'justify-center'
  )
}

// 关系字段批量编辑组件（用于处理异步选项加载）
function RelationFieldBatchEdit({
  fieldKey,
  fieldConfig,
  fieldValue,
  onValueChange,
  loadOptions,
  loadFuzzyOptions,
}: {
  fieldKey: string
  fieldConfig: FieldConfig
  fieldValue: any
  onValueChange: (fieldKey: string, value: any) => void
  loadOptions?: () => Promise<Array<{ label: string; value: string }>>
  loadFuzzyOptions?: (search: string) => Promise<FuzzySearchOption[]>
}) {
  const [options, setOptions] = React.useState<Array<{ label: string; value: string }>>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (loadOptions) {
      setLoading(true)
      loadOptions()
        .then((loadedOptions) => {
          setOptions(loadedOptions)
        })
        .catch((error) => {
          console.error(`加载${fieldConfig.label}选项失败:`, error)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [loadOptions, fieldConfig.label])

  if (loadOptions) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {fieldConfig.label}
        </label>
        <select
          value={fieldValue || ''}
          onChange={(e) => onValueChange(fieldKey, e.target.value || null)}
          disabled={loading}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">（留空则不修改）</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // 如果没有 loadOptions，使用文本输入（回退方案）
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {fieldConfig.label}
      </label>
      <input
        type="text"
        value={fieldValue || ''}
        onChange={(e) => onValueChange(fieldKey, e.target.value)}
        placeholder={`输入新的${fieldConfig.label}（留空则不修改）`}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}

/** 与 handleSaveEdit 中关系字段映射一致，用于展示层解析 DB 外键列名 */
function relationDbFieldNameForDisplay(fieldKey: string, fieldConfig: FieldConfig): string {
  if (fieldConfig.relationField) return fieldConfig.relationField
  if (fieldKey === 'received_by' || fieldKey === 'unloaded_by') return fieldKey
  if (fieldKey === 'carrier') return 'carrier_id'
  if (fieldKey === 'loaded_by_name') return 'loaded_by'
  if (fieldKey === 'trailer_code') return 'trailer_code'
  if (fieldKey.endsWith('_id')) return fieldKey
  return `${fieldKey}_id`
}

function normalizeRelationDraftId(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  if (s === '' || s === 'NaN') return null
  return s
}

/**
 * 关系字段行内草稿：非编辑态须显示草稿值 +「待保存」（原先 relation 分支忽略 dPref，承运公司等会一直显示旧名称）
 */
function RelationInlineDraftRowDisplay({
  rowOriginal,
  fieldKey,
  fieldConfig,
  draftRaw,
  loadFuzzyOptions,
  wrapIfEditable,
  renderCommitted,
}: {
  rowOriginal: any
  fieldKey: string
  fieldConfig: FieldConfig
  draftRaw: unknown
  loadFuzzyOptions?: (search: string) => Promise<FuzzySearchOption[]>
  wrapIfEditable: (node: React.ReactNode) => React.ReactNode
  renderCommitted: () => React.ReactNode
}) {
  const dbField = relationDbFieldNameForDisplay(fieldKey, fieldConfig)
  let draftId: string | null
  if (typeof draftRaw === 'object' && draftRaw !== null && 'carrier_id' in draftRaw) {
    draftId = normalizeRelationDraftId((draftRaw as { carrier_id?: unknown }).carrier_id)
  } else {
    draftId = normalizeRelationDraftId(draftRaw)
  }

  const originalId = (() => {
    const top = normalizeRelationDraftId(rowOriginal[dbField])
    if (top !== null) return top
    if (fieldKey === 'carrier' && rowOriginal.carrier?.carrier_id != null) {
      return normalizeRelationDraftId(rowOriginal.carrier.carrier_id)
    }
    if (fieldKey === 'customer' && rowOriginal.customer?.id != null) {
      return normalizeRelationDraftId(rowOriginal.customer.id)
    }
    return null
  })()

  const dirty = (draftId ?? '') !== (originalId ?? '')

  if (!dirty) {
    return <>{renderCommitted()}</>
  }

  const [label, setLabel] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!loadFuzzyOptions || draftId === null) {
      setLabel(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const run = async () => {
      try {
        let opts = await loadFuzzyOptions('')
        if (cancelled) return
        let found = opts.find((o) => String(o.value) === draftId)
        if (!found) {
          opts = await loadFuzzyOptions(draftId)
          if (cancelled) return
          found = opts.find((o) => String(o.value) === draftId)
        }
        setLabel(found?.label ?? null)
      } catch {
        if (!cancelled) setLabel(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [loadFuzzyOptions, draftId])

  const displayText =
    draftId === null
      ? originalId !== null
        ? '（已清空）'
        : '—'
      : loading
        ? '加载中…'
        : label || `${fieldConfig.label || fieldKey}（${draftId}）`

  return wrapIfEditable(
    <div className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-1 text-amber-800 dark:text-amber-300 font-medium">
      <span className="min-w-0 truncate">{displayText}</span>
      <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400">待保存</span>
    </div>
  )
}

/** 与 handleSaveEdit 中 location 分支一致 */
function locationDbFieldForDisplay(fieldKey: string): string {
  if (fieldKey === 'destination_location') return 'location_id'
  if (fieldKey === 'location_id' || fieldKey === 'origin_location_id') return fieldKey
  return `${fieldKey}_id`
}

function normalizeLocationIdForDisplay(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  if (s === '' || s === 'NaN') return null
  return s
}

/**
 * location 行内草稿存 ID；与 relation 草稿态一致：琥珀色 +「待保存」。
 * 先展示「标签（ID）」不阻塞，后台拉 /api/locations/:id 换成 code/name。
 */
function LocationInlineDisplayCell({
  row,
  fieldKey,
  fieldConfig,
  dPref,
  wrapIfEditable,
}: {
  row: { original: any; getValue: (columnId: string) => unknown }
  fieldKey: string
  fieldConfig: FieldConfig
  dPref: unknown
  wrapIfEditable: (node: React.ReactNode) => React.ReactNode
}) {
  const rowOriginal = row.original
  const dbField = locationDbFieldForDisplay(fieldKey)
  const committedId = normalizeLocationIdForDisplay(rowOriginal[dbField])

  let committedText: string | null = null
  try {
    const gv = row.getValue(fieldKey)
    if (gv != null && String(gv).trim() !== '') committedText = String(gv)
  } catch {
    /* ignore */
  }
  if (
    committedText == null &&
    rowOriginal[fieldKey] != null &&
    String(rowOriginal[fieldKey]).trim() !== ''
  ) {
    committedText = String(rowOriginal[fieldKey])
  }

  const wrapDirty = (main: React.ReactNode) =>
    wrapIfEditable(
      <div className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-1 text-amber-800 dark:text-amber-300 font-medium">
        <span className="min-w-0 truncate">{main}</span>
        <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400">待保存</span>
      </div>
    )

  if (dPref === undefined) {
    return wrapIfEditable(<div>{committedText || committedId || '-'}</div>)
  }

  const draftId = normalizeLocationIdForDisplay(dPref)

  if ((draftId ?? '') === (committedId ?? '')) {
    return wrapIfEditable(<div>{committedText || draftId || '-'}</div>)
  }

  if (draftId === null) {
    return wrapDirty(committedId !== null ? '（已清空）' : '—')
  }

  const [resolved, setResolved] = React.useState<string | null>(null)
  React.useEffect(() => {
    let cancelled = false
    fetch(`/api/locations/${encodeURIComponent(draftId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not ok'))))
      .then((raw) => {
        if (cancelled) return
        const loc = raw?.data ?? raw
        const text =
          (loc?.location_code != null && String(loc.location_code).trim() !== ''
            ? String(loc.location_code)
            : null) ??
          (loc?.name != null ? String(loc.name) : null) ??
          draftId
        setResolved(text)
      })
      .catch(() => {
        if (!cancelled) setResolved(draftId)
      })
    return () => {
      cancelled = true
    }
  }, [draftId])

  const displayText = resolved ?? `${fieldConfig.label || fieldKey}（${draftId}）`
  return wrapDirty(displayText)
}

/** 行内编辑时按字段类型给列宽上下限，避免 date/弹层控件被 200px 封顶裁切 */
function buildInlineEditColumnWidthHints(
  columnIds: Set<string>,
  fields: Record<string, FieldConfig>
): Record<string, InlineEditColumnWidthHint> | undefined {
  const hints: Record<string, InlineEditColumnWidthHint> = {}
  for (const id of columnIds) {
    const f = fields[id]
    const t = f?.type
    if (t === "date") {
      // 与 InlineEditCell 固定 date 宽度 + 清空按钮一致；列本身勿再留大块空档
      hints[id] = { min: 228, max: 252 }
    } else if (t === "datetime") {
      hints[id] =
        id === "pickup_date"
          ? { min: 360, max: 440 }
          : { min: 312, max: 384 }
    } else if (t === "textarea") {
      hints[id] = { min: 240, max: 400 }
    } else if (t === "location") {
      // LocationSelect：图标 + 文案 + 清空 + chevron；过窄会只剩「选…」
      hints[id] = { min: 300, max: 340 }
    } else if (t === "relation") {
      hints[id] = { min: 220, max: 288 }
    }
  }
  return Object.keys(hints).length > 0 ? hints : undefined
}

interface EntityTableProps<T = any> {
  config: EntityConfig
  FormComponent?: React.ComponentType<any>
  customColumns?: ColumnDef<T>[] // 自定义列定义（如果提供，则使用自定义列而不是自动生成）
  customActions?: {
    onView?: ((item: T) => void) | null // null 表示隐藏查看详情按钮
    onDelete?: ((item: T) => void) | null // null 表示隐藏删除按钮
    onAdd?: () => void
  } // 自定义操作（如果提供，则使用自定义操作）
  customSortableColumns?: string[] // 自定义可排序列
  customColumnLabels?: Record<string, string> // 自定义列标签
  customClickableColumns?: ClickableColumnConfig<T>[] // 自定义可点击列配置
  fieldLoadOptions?: Record<string, () => Promise<Array<{ label: string; value: string }>>> // 字段选项加载函数（用于 select 类型字段）
  fieldFuzzyLoadOptions?: Record<string, (search: string) => Promise<FuzzySearchOption[]>> // 字段模糊搜索加载函数（用于 relation 类型字段）
  customSaveHandler?: (row: T, updates: Record<string, any>) => Promise<void> // 自定义保存处理函数（如果提供，则使用自定义保存逻辑）
  expandableRows?: {
    enabled: boolean
    getExpandedContent?: (row: T) => React.ReactNode | null // 获取展开内容
  } // 可展开行配置
  customToolbarButtons?: React.ReactNode // 自定义工具栏按钮（显示在新建按钮旁边）
  customBatchActions?: React.ReactNode // 自定义批量操作按钮（显示在批量操作工具栏中）
  onSearchParamsChange?: (params: URLSearchParams) => void // 搜索参数变化回调
  onTotalChange?: (total: number) => void // 总数变化回调
  onFilteredTotalChange?: (filteredTotal: number) => void // 筛选后总数变化回调
  importConfig?: {
    enabled: boolean // 是否启用批量导入
    onImport: () => void // 导入按钮点击回调
  } // 批量导入配置
  onRowSelectionChange?: (rows: T[]) => void // 行选择变化回调
  refreshKey?: number | string // 刷新触发器（变化时重新获取数据，但不卸载组件）
  /** 默认筛选条件：当 URL 中没有任何 filter_ 参数时应用（例如入库管理默认本周拆柜） */
  initialFilterValues?: Record<string, string>
  /** 在快速筛选区域渲染的额外内容，传入 applyFilterValues 可一次性设置多个筛选并刷新 */
  customFilterContent?: (applyFilterValues: (v: Record<string, any>) => void) => React.ReactNode
  /** 附加到列表 API 与地址栏的固定查询参数（如提柜管理 lfd_no_pickup），由父组件控制 */
  extraListParams?: Record<string, string>
  /** 按列 id / accessorKey 覆盖单元格渲染（完全接管该列展示与交互，例如订单明细内联编辑） */
  customCellRenderers?: Partial<Record<string, (args: { row: any }) => React.ReactNode>>
  /** 页面级草稿保存（如码头/板数批量保存）；会并入统计栏「保存修改」按钮 */
  pageDraftSave?: {
    count: number
    saving?: boolean
    onSave: () => Promise<boolean> | boolean
    label?: string
  }
  /** 换页/改每页条数前拦截（例如有未保存草稿）；confirm 返回 true 才应用分页 */
  paginationChangeGuard?: {
    shouldIntercept: () => boolean
    confirm: (intent: { nextPage: number; nextPageSize: number }) => Promise<boolean>
  }
  /** 与行内编辑列宽放宽合并（如自定义列 `port_location` 不在 activeInlineFieldByRow 内） */
  additionalInlineUnboundedColumnIds?: readonly string[]
}

export function EntityTable<T = any>({ 
  config, 
  FormComponent,
  customColumns,
  customActions,
  customSortableColumns,
  customColumnLabels,
  customClickableColumns,
  fieldLoadOptions,
  fieldFuzzyLoadOptions,
  customSaveHandler,
  expandableRows,
  customToolbarButtons,
  customBatchActions,
  importConfig,
  onRowSelectionChange,
  onSearchParamsChange,
  onTotalChange,
  onFilteredTotalChange,
  refreshKey,
  initialFilterValues,
  customFilterContent,
  extraListParams = EMPTY_EXTRA_LIST_PARAMS,
  customCellRenderers,
  pageDraftSave,
  paginationChangeGuard,
  additionalInlineUnboundedColumnIds,
}: EntityTableProps<T>) {
  // 自动增强配置，生成 filterFields 和 advancedSearchFields（如果未配置）
  const enhancedConfig = React.useMemo(() => {
    return enhanceConfigWithSearchFields(config)
  }, [config])
  
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = React.useState<T[]>([])
  const [loading, setLoading] = React.useState(true)
  const [openDialog, setOpenDialog] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [itemToDelete, setItemToDelete] = React.useState<T | null>(null)
  const [editingItem, setEditingItem] = React.useState<T | null>(null)
  
  const defaultPageSize = config.list.pageSize || 10
  const [page, setPage] = React.useState(() => {
    if (typeof window === 'undefined') return 1
    const p = new URLSearchParams(window.location.search).get('page')
    const n = p ? parseInt(p, 10) : 1
    return !Number.isNaN(n) && n >= 1 ? n : 1
  })
  const [pageSize, setPageSize] = React.useState(() => {
    if (typeof window === 'undefined') return defaultPageSize
    const p = new URLSearchParams(window.location.search).get('limit')
    const n = p ? parseInt(p, 10) : defaultPageSize
    return !Number.isNaN(n) && n >= 1 ? n : defaultPageSize
  })
  const [total, setTotal] = React.useState(0)
  const [sort, setSort] = React.useState(config.list.defaultSort)
  const [order, setOrder] = React.useState<'asc' | 'desc'>(config.list.defaultOrder)
  const [sorting, setSorting] = React.useState([{ 
    id: config.list.defaultSort, 
    desc: config.list.defaultOrder === 'desc' 
  }])
  
  // 搜索状态
  const [search, setSearch] = React.useState('')
  const [searchInput, setSearchInput] = React.useState('')
  
  // 当路径变化时，重置搜索状态（清除之前的搜索值）
  // 使用 ref 来跟踪上一个路径，避免重复触发
  const prevPathnameRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // 如果路径真的变化了（不是初始化）
      if (prevPathnameRef.current !== null && prevPathnameRef.current !== pathname) {
        // 路径变化时，强制清除所有搜索状态
        // 设置标志，让防抖逻辑立即执行（不等待300ms）
        isPathChangingRef.current = true
        // 先清除 searchInput（这会触发防抖的 useEffect，但由于 isPathChangingRef，会立即更新 search）
        setSearchInput('')
        // 同时直接清除 search（确保立即生效）
        setSearch('')
        setPage(1)
        // search 状态变化会触发 fetchData 的 useEffect，使用空字符串
      }
      
      prevPathnameRef.current = pathname
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]) // 只在路径变化时触发
  
  // 筛选状态（若传入 initialFilterValues 则用其初始化，保证首屏请求即带默认筛选）
  const [filterValues, setFilterValues] = React.useState<Record<string, any>>(() => initialFilterValues ?? {})
  
  // 高级搜索状态
  const [advancedSearchOpen, setAdvancedSearchOpen] = React.useState(false)
  const [advancedSearchValues, setAdvancedSearchValues] = React.useState<Record<string, any>>({})
  const [advancedSearchLogic, setAdvancedSearchLogic] = React.useState<'AND' | 'OR'>('AND')
  
  // ========== 客户端挂载后从 URL 恢复状态（useLayoutEffect 在首帧同步执行，早于 URL 同步，避免被 page=1 覆盖） ==========
  React.useLayoutEffect(() => {
    if (typeof window === 'undefined') return

    hasInitialized.current = false
    isInitializingFromURL.current = true
    searchRestoredFromUrlRef.current = true

    const params = new URLSearchParams(window.location.search)
    
    // 分页和排序
    const urlPage = params.get('page')
    const urlLimit = params.get('limit')
    const urlSort = params.get('sort')
    const urlOrder = params.get('order')
    
    const parsedPage = urlPage ? parseInt(urlPage, 10) : NaN
    if (!Number.isNaN(parsedPage) && parsedPage >= 1) setPage(parsedPage)
    const parsedLimit = urlLimit ? parseInt(urlLimit, 10) : NaN
    if (!Number.isNaN(parsedLimit) && parsedLimit >= 1) setPageSize(parsedLimit)
    if (urlSort) {
      setSort(urlSort)
      setSorting([{ id: urlSort, desc: (urlOrder || config.list.defaultOrder) === 'desc' }])
    }
    if (urlOrder) setOrder(urlOrder as 'asc' | 'desc')
    
    const urlSearch = params.get('search')
    if (urlSearch) {
      setSearch(urlSearch)
      setSearchInput(urlSearch)
    }
    
    // 筛选条件（filter_开头的参数）
    const filters: Record<string, any> = {}
    params.forEach((value, key) => {
      if (key.startsWith('filter_')) {
        const filterKey = key.replace('filter_', '')
        filters[filterKey] = value
      }
    })
    // 若 URL 中无任何筛选参数且传入了 initialFilterValues，则使用默认筛选（如入库管理默认本周拆柜）
    if (Object.keys(filters).length === 0 && initialFilterValues && Object.keys(initialFilterValues).length > 0) {
      Object.assign(filters, initialFilterValues)
    }
    if (Object.keys(filters).length > 0) {
      setFilterValues(filters)
    }
    
    // 高级搜索（advanced_开头的参数）
    const advancedSearch: Record<string, any> = {}
    params.forEach((value, key) => {
      if (key.startsWith('advanced_') && key !== 'advanced_logic') {
        const searchKey = key.replace('advanced_', '')
        advancedSearch[searchKey] = value
      }
    })
    if (Object.keys(advancedSearch).length > 0) {
      setAdvancedSearchValues(advancedSearch)
    }
    
    const advancedLogic = params.get('advanced_logic')
    if (advancedLogic) {
      setAdvancedSearchLogic(advancedLogic as 'AND' | 'OR')
    }
    
    // 延迟一帧再允许 URL 同步，避免本周期内用 page=1 覆盖地址栏
    const t = window.setTimeout(() => {
      isInitializingFromURL.current = false
      hasInitialized.current = true
    }, 0)
    return () => window.clearTimeout(t)
  }, [config.list.defaultOrder])
  
  // 批量操作状态
  const [selectedRows, setSelectedRows] = React.useState<T[]>([])
  const [batchEditDialogOpen, setBatchEditDialogOpen] = React.useState(false)
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = React.useState(false)
  const [batchEditValues, setBatchEditValues] = React.useState<Record<string, any>>({})
  
  const isInitializingFromURL = React.useRef(false)
  const hasInitialized = React.useRef(false)
  const allowUrlSyncRef = React.useRef(false)
  const searchRestoredFromUrlRef = React.useRef(false)

  React.useEffect(() => {
    if (!allowUrlSyncRef.current || isInitializingFromURL.current) return
    if (typeof window === 'undefined') return

    const params = new URLSearchParams()
    
    // 分页（始终写入 URL，便于刷新后保持当前页）
    params.set('page', String(page))
    if (pageSize !== (config.list.pageSize || 10)) {
      params.set('limit', String(pageSize))
    }
    
    // 排序
    if (sort !== config.list.defaultSort) {
      params.set('sort', sort)
    }
    if (order !== config.list.defaultOrder) {
      params.set('order', order)
    }
    
    // 搜索
    if (search) {
      params.set('search', search)
    }
    
    // 筛选条件
    Object.entries(filterValues).forEach(([key, value]) => {
      const isEmpty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
      if (!isEmpty) {
        const paramValue = Array.isArray(value) ? value.join(',') : String(value)
        params.set(`filter_${key}`, paramValue)
      }
    })
    
    // 高级搜索
    Object.entries(advancedSearchValues).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.set(`advanced_${key}`, String(value))
      }
    })
    
    if (Object.keys(advancedSearchValues).length > 0 && advancedSearchLogic !== 'AND') {
      params.set('advanced_logic', advancedSearchLogic)
    }

    Object.entries(extraListParams).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, value)
      }
    })
    
    // 更新URL（使用replace避免堆积历史记录，scroll: false避免页面跳动）
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.replace(newUrl, { scroll: false })
    
    // 通知父组件
    onSearchParamsChange?.(params)
  }, [
    page,
    pageSize,
    sort,
    order,
    search,
    filterValues,
    advancedSearchValues,
    advancedSearchLogic,
    pathname,
    router,
    config.list.pageSize,
    config.list.defaultSort,
    config.list.defaultOrder,
    extraListParams,
    onSearchParamsChange,
  ])
  
  // 当选中行变化时，通知父组件
  React.useEffect(() => {
    onRowSelectionChange?.(selectedRows)
  }, [selectedRows, onRowSelectionChange])
  
  // 批量编辑字段更新处理函数（使用函数式更新，避免闭包问题）
  const handleBatchEditValueChange = React.useCallback((fieldKey: string, value: any) => {
    setBatchEditValues(prev => ({ ...prev, [fieldKey]: value }))
  }, [])
  
  // 行内编辑：支持多行草稿（与铅笔编辑同一套字段），顶部可批量保存
  const [draftRowIds, setDraftRowIds] = React.useState<string[]>([])
  const draftValuesByRowRef = React.useRef<Record<string, Record<string, any>>>({})
  /** 铅笔/点格进入编辑时的「首字段」键：仅用于 autoOpenDropdown，避免多列同时自动弹开下拉 */
  const [activeInlineFieldByRow, setActiveInlineFieldByRow] = React.useState<
    Record<string, string>
  >({})
  /** 铅笔=整行可编辑 UI；点单元格=仅该格（与 draft 键一致，如 location_id） */
  const [rowInlineEditScopeByRow, setRowInlineEditScopeByRow] = React.useState<
    Record<string, { kind: 'all' } | { kind: 'single'; field: string }>
  >({})
  const [savingAllDrafts, setSavingAllDrafts] = React.useState(false)
  const [isMounted, setIsMounted] = React.useState(false)
  
  // 确保只在客户端渲染编辑相关功能
  React.useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // 获取可批量编辑的字段列表（使用 useMemo 避免每次渲染重新计算）
  const batchEditableFields = React.useMemo(() => {
    const idField = config.idField || 'id'
    return config.list.batchOperations?.edit?.fields || 
      Object.keys(config.fields).filter(key => {
        const field = config.fields[key]
        // 排除主键字段
        return key !== idField && field.type !== 'relation'
      })
  }, [config.list.batchOperations?.edit?.fields, config.fields, config.idField])

  const fetchAbortRef = React.useRef<AbortController | null>(null)
  // 获取列表数据（新请求会取消上一次未完成的请求，避免刷新后 page=1 的响应覆盖 page=7）
  const fetchData = React.useCallback(async (
    currentPage: number,
    currentPageSize: number,
    currentSort: string,
    currentOrder: 'asc' | 'desc',
    currentSearch: string,
    currentFilters?: Record<string, any>,
    currentAdvancedSearch?: Record<string, any>,
    currentLogic?: 'AND' | 'OR'
  ) => {
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort()
    }
    const controller = new AbortController()
    fetchAbortRef.current = controller
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(currentPageSize),
        sort: currentSort,
        order: currentOrder,
      })
      if (currentSearch) {
        params.append('search', currentSearch)
      }
      
      // 添加筛选参数
      if (currentFilters) {
        Object.entries(currentFilters).forEach(([key, value]) => {
          const isEmpty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
          if (!isEmpty) {
            const paramValue = Array.isArray(value) ? value.join(',') : String(value)
            params.append(`filter_${key}`, paramValue)
          }
        })
      }
      
      // 添加高级搜索参数
      if (currentAdvancedSearch) {
        Object.entries(currentAdvancedSearch).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            params.append(`advanced_${key}`, String(value))
          }
        })
        if (currentLogic) {
          params.append('advanced_logic', currentLogic)
        }
      }

      Object.entries(extraListParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.set(key, value)
        }
      })
      
      const apiUrl = `${config.apiPath}?${params.toString()}`
      
      const response = await fetch(apiUrl, { signal: controller.signal })
      
      if (fetchAbortRef.current !== controller) return
      if (!response.ok) {
        let errorMessage = `获取${config.displayName}列表失败`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          if (process.env.NODE_ENV === 'development') {
            console.error(`[EntityTable] API错误 (${response.status}):`, errorData)
          }
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[EntityTable] API错误 (${response.status}):`, response.statusText)
          }
          errorMessage = `HTTP ${response.status}: ${response.statusText || '请求失败'}`
        }
        throw new Error(errorMessage)
      }
      
      const result = await response.json()
      
      if (!result || typeof result !== 'object') {
        throw new Error('服务器返回数据格式错误')
      }
      
      if (fetchAbortRef.current !== controller) return
      setData(result.data || [])
      const newTotal = result.pagination?.total ?? result.total ?? 0
      setTotal(newTotal)
      
      // 触发回调
      if (onSearchParamsChange) {
        onSearchParamsChange(params)
      }
      if (onTotalChange) {
        // 注意：这里的total是所有数据的总数，不是筛选后的总数
        // 如果有筛选条件，应该传递筛选后的总数
        onTotalChange(newTotal)
      }
      if (onFilteredTotalChange) {
        // 如果有筛选或搜索条件，传递当前total，否则传递总数
        onFilteredTotalChange(newTotal)
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error(`[EntityTable] 获取${config.displayName}列表失败:`, error)
      const errorMsg = error?.message || `获取${config.displayName}列表失败`
      toast.error(errorMsg)
      setData([])
      setTotal(0)
      if (onTotalChange) onTotalChange(0)
      if (onFilteredTotalChange) onFilteredTotalChange(0)
    } finally {
      if (fetchAbortRef.current === controller) setLoading(false)
    }
  }, [
    config.apiPath,
    config.displayName,
    extraListParams,
    onSearchParamsChange,
    onTotalChange,
    onFilteredTotalChange,
  ])

  React.useEffect(() => {
    fetchData(page, pageSize, sort, order, search, filterValues, advancedSearchValues, advancedSearchLogic)
  }, [fetchData, page, pageSize, sort, order, search, filterValues, advancedSearchValues, advancedSearchLogic, refreshKey])
  
  // 处理搜索（防抖）
  // 使用 ref 来跟踪是否正在处理路径变化
  const isPathChangingRef = React.useRef(false)
  
  React.useEffect(() => {
    if (isPathChangingRef.current) {
      setSearch(searchInput)
      setPage(1)
      isPathChangingRef.current = false
    } else {
      const timer = setTimeout(() => {
        if (searchRestoredFromUrlRef.current) {
          searchRestoredFromUrlRef.current = false
          setSearch(searchInput)
          return
        }
        if (hasInitialized.current) allowUrlSyncRef.current = true
        setSearch(searchInput)
        setPage(1)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [searchInput])

  const handleSortingChange = (newSorting: Array<{ id: string; desc: boolean }>) => {
    allowUrlSyncRef.current = true
    setSorting(newSorting)
    if (newSorting.length > 0) {
      const sortItem = newSorting[0]
      setSort(sortItem.id)
      setOrder(sortItem.desc ? 'desc' : 'asc')
      setPage(1)
    } else {
      setSort(config.list.defaultSort)
      setOrder(config.list.defaultOrder)
      setPage(1)
      setSorting([{ id: config.list.defaultSort, desc: config.list.defaultOrder === 'desc' }])
    }
  }

  // 处理创建
  const handleCreate = () => {
    // 如果提供了自定义 onAdd，使用自定义处理
    if (customActions?.onAdd) {
      customActions.onAdd()
      return
    }
    // 否则使用默认的表单对话框
    setEditingItem(null)
    setOpenDialog(true)
  }

  // 获取ID字段名
  const getIdField = () => config.idField || 'id'
  
  // 获取行的ID值（用于行选择）
  const getIdValue = React.useCallback((row: T): string | number => {
    const idField = getIdField()
    const id = (row as any)[idField]
    return id !== null && id !== undefined ? String(id) : ''
  }, [config.idField])
  
  // 检查是否启用批量操作（默认启用）
  const batchOpsEnabled = config.list.batchOperations?.enabled !== false
  // 如果批量操作启用，默认显示批量编辑和批量删除（除非明确禁用）
  const batchEditEnabled = batchOpsEnabled && (config.list.batchOperations?.edit?.enabled !== false)
  // 批量删除需要同时满足：1. 批量操作启用 2. 删除功能未禁用 3. 有删除权限
  const hasDeletePermission = config.permissions.delete && config.permissions.delete.length > 0
  const batchDeleteEnabled = batchOpsEnabled && 
    (config.list.batchOperations?.delete?.enabled !== false) && 
    hasDeletePermission
  
  // 检查是否启用行内编辑（默认启用，如果有 update 权限）
  const inlineEditEnabled = config.list.inlineEdit?.enabled !== false && 
    config.permissions.update && config.permissions.update.length > 0
  /** 为 false 时仅铅笔进入草稿，单元格点击不进入编辑 */
  const inlineEditCellClickEnabled = config.list.inlineEdit?.cellClickToEdit !== false
  const pageDraftCount = Math.max(0, pageDraftSave?.count ?? 0)
  const hasAnyDraftsToSave = (inlineEditEnabled && draftRowIds.length > 0) || pageDraftCount > 0
  const isSavingAnyDrafts = savingAllDrafts || Boolean(pageDraftSave?.saving)
  const totalDraftCount = (inlineEditEnabled ? draftRowIds.length : 0) + pageDraftCount
  
  // 获取可编辑字段列表
  const editableFields = React.useMemo(() => {
    if (!inlineEditEnabled) return []
    const configuredFields = config.list.inlineEdit?.fields
    if (configuredFields && configuredFields.length > 0) {
      return configuredFields
    }
    // 如果没有配置，则所有非主键、非关系字段都可编辑
    return Object.keys(config.fields).filter(key => {
      const field = config.fields[key]
      return key !== getIdField() && field.type !== 'relation'
    })
  }, [inlineEditEnabled, config.list.inlineEdit?.fields, config.fields, config.idField])

  const inlineEditUnboundedColumnIds = React.useMemo(() => {
    const s = new Set<string>(Object.values(activeInlineFieldByRow))
    for (const id of additionalInlineUnboundedColumnIds ?? []) {
      s.add(id)
    }
    if (draftRowIds.length > 0 && inlineEditEnabled) {
      for (const k of editableFields) {
        s.add(k)
      }
      for (const c of filterAuditFields(config.list.columns, config.idField)) {
        s.add(c)
      }
    }
    return s
  }, [
    activeInlineFieldByRow,
    additionalInlineUnboundedColumnIds,
    draftRowIds.length,
    inlineEditEnabled,
    editableFields,
    config.list.columns,
    config.idField,
  ])

  const inlineEditColumnWidthHints = React.useMemo(() => {
    if (!inlineEditEnabled) return undefined
    return buildInlineEditColumnWidthHints(
      inlineEditUnboundedColumnIds,
      enhancedConfig.fields
    )
  }, [inlineEditEnabled, inlineEditUnboundedColumnIds, enhancedConfig.fields])
  
  // 检查行是否处于草稿编辑中（只在客户端检查，避免 hydration 错误）
  const isRowEditing = React.useCallback((row: T): boolean => {
    if (!isMounted) return false // 服务器端始终返回 false
    const idField = getIdField()
    const rowId = String((row as any)[idField])
    return draftRowIds.includes(rowId)
  }, [draftRowIds, config.idField, isMounted])
  
  const handleStartEdit = React.useCallback((row: T, focusFieldKey?: string) => {
    const idField = getIdField()
    const rowId = (row as any)[idField]
    const idStr = String(rowId)
    const resolveFocusKey = (): string => {
      if (focusFieldKey && editableFields.includes(focusFieldKey)) {
        return focusFieldKey
      }
      return editableFields[0] ?? ""
    }
    const focusKey = resolveFocusKey()

    // 初始化编辑值（只包含可编辑字段）——仅在该行尚无草稿时写入，避免切换单元格时冲掉已改内容
    const buildInitialValues = (): Record<string, any> => {
      const initialValues: Record<string, any> = {}
      editableFields.forEach(fieldKey => {
        // 处理字段名映射：parent_id -> parent, manager_id -> manager, location_id -> destination_location
        let actualFieldKey = fieldKey
        let fieldConfig = config.fields[fieldKey]
        
        if (!fieldConfig) {
          // 尝试映射字段名
          if (fieldKey === 'parent_id') {
            fieldConfig = config.fields['parent']
            actualFieldKey = 'parent'
          } else if (fieldKey === 'manager_id') {
            fieldConfig = config.fields['manager']
            actualFieldKey = 'manager'
          } else if (fieldKey === 'department_id') {
            fieldConfig = config.fields['department']
            actualFieldKey = 'department'
          } else if (fieldKey === 'location_id') {
            // location_id 映射到 destination_location 字段配置
            fieldConfig = config.fields['destination_location']
            actualFieldKey = 'destination_location'
          } else if (fieldKey === 'origin_location_id') {
            // origin_location_id 映射到 origin_location 字段配置
            fieldConfig = config.fields['origin_location']
            actualFieldKey = 'origin_location'
          }
        }
        
        // 对于 relation 字段，优先使用 _id 字段的值
        if (fieldConfig?.type === 'relation') {
          // 确定 ID 字段名：优先使用 relationField，然后检查特殊字段名
          let idKey: string
          if (fieldConfig.relationField) {
            // 如果配置了 relationField（如 loaded_by_name 的 relationField 是 loaded_by），使用它
            idKey = fieldConfig.relationField
          } else if (fieldKey === 'parent_id' || fieldKey === 'manager_id' || fieldKey === 'department_id') {
            // 对于 parent_id、manager_id 和 department_id，直接使用 fieldKey 作为 idKey
            idKey = fieldKey
          } else {
            // 默认：尝试使用 ${fieldKey}_id
            idKey = `${fieldKey}_id`
          }
          
          let idValue = (row as any)[idKey]
          // locations 关联：列表行上常为嵌套对象 { location_id, location_code }，不能回退成纯代码字符串当 ID
          if (
            (idValue === undefined || idValue === null) &&
            fieldConfig.relation?.model === 'locations'
          ) {
            const nested = (row as any)[fieldKey]
            if (nested && typeof nested === 'object' && nested.location_id != null) {
              idValue = nested.location_id
            }
          }
          if (idValue !== undefined && idValue !== null) {
            initialValues[fieldKey] = String(idValue)
          } else {
            // 如果没有 _id 字段，使用原字段的值（可能是 ID 或显示值）
            initialValues[fieldKey] = (row as any)[fieldKey] || null
          }
        } else if (fieldConfig?.type === 'location') {
          // 对于location字段，使用对应的_id字段的值
          // 特殊处理：location_id 和 origin_location_id 直接使用 fieldKey 作为 idKey
          let idKey: string
          if (fieldKey === 'location_id' || fieldKey === 'origin_location_id') {
            idKey = fieldKey
          } else {
            idKey = `${fieldKey}_id`
          }
          const idValue = (row as any)[idKey]
          if (idValue !== undefined && idValue !== null) {
            initialValues[fieldKey] = String(idValue)
          } else {
            // 如果没有_id字段，尝试使用原字段的值（可能是location_code字符串）
            initialValues[fieldKey] = (row as any)[fieldKey] || null
          }
        } else if (fieldConfig?.type === 'date') {
          // 对于日期字段，格式化为 YYYY-MM-DD 格式
          const dateValue = (row as any)[fieldKey]
          if (dateValue === null || dateValue === undefined) {
            initialValues[fieldKey] = null
          } else if (dateValue instanceof Date) {
            initialValues[fieldKey] = dateValue.toISOString().split('T')[0]
          } else if (typeof dateValue === 'string') {
            // 可能是 ISO 字符串或 YYYY-MM-DD 格式
            initialValues[fieldKey] = dateValue.split('T')[0]
          } else {
            initialValues[fieldKey] = dateValue
          }
        } else if (fieldConfig?.type === 'datetime') {
          // 对于日期时间字段，格式化为 ISO 字符串
          const dateValue = (row as any)[fieldKey]
          if (dateValue === null || dateValue === undefined) {
            initialValues[fieldKey] = null
          } else if (dateValue instanceof Date) {
            initialValues[fieldKey] = dateValue.toISOString()
          } else {
            initialValues[fieldKey] = dateValue
          }
        } else {
          initialValues[fieldKey] = (row as any)[fieldKey]
        }
      })
      return initialValues
    }

    // 清空批量勾选；草稿状态必须在 setSelectedRows 的 updater 之外调度，避免在 updater 内同步 setState 导致更新丢失（React 不推荐在 updater 里触发其它 setState）
    const applyDraftAndFocus = () => {
      if (!draftValuesByRowRef.current[idStr]) {
        draftValuesByRowRef.current[idStr] = buildInitialValues()
      }
      setDraftRowIds((prev) => (prev.includes(idStr) ? prev : [...prev, idStr]))
      const fromCell =
        typeof focusFieldKey === 'string' &&
        focusFieldKey.trim() !== '' &&
        editableFields.includes(focusFieldKey)
      setRowInlineEditScopeByRow((prev) => ({
        ...prev,
        [idStr]: fromCell ? { kind: 'single', field: focusFieldKey.trim() } : { kind: 'all' },
      }))
      // 仅标记首字段：多列同时显示编辑 UI 时，只对匹配列 autoOpenDropdown，避免所有下拉一起弹开
      setActiveInlineFieldByRow({ [idStr]: focusKey })
    }

    setSelectedRows((prevSelectedRows) => {
      const hasSelectedRows = prevSelectedRows.length > 0
      if (hasSelectedRows) {
        setTimeout(applyDraftAndFocus, 10)
      } else {
        queueMicrotask(applyDraftAndFocus)
      }
      return []
    })
  }, [editableFields, config.idField, config.fields])
  
  const handleEditValueChange = React.useCallback((rowId: string, fieldKey: string, value: any) => {
    if (!draftValuesByRowRef.current[rowId]) {
      draftValuesByRowRef.current[rowId] = {}
    }
    draftValuesByRowRef.current[rowId][fieldKey] = value
  }, [])

  /** 行内字段 onChange（按行隔离） */
  const getFieldOnChange = React.useCallback(
    (rowId: string, fieldKey: string) => (value: any) => {
      handleEditValueChange(rowId, fieldKey, value)
    },
    [handleEditValueChange]
  )
  
  const clearDraftForRowId = React.useCallback((rowId: string) => {
    delete draftValuesByRowRef.current[rowId]
    setDraftRowIds((prev) => prev.filter((x) => x !== rowId))
    setActiveInlineFieldByRow((prev) => {
      const { [rowId]: _, ...rest } = prev
      return rest
    })
    setRowInlineEditScopeByRow((prev) => {
      const { [rowId]: _, ...rest } = prev
      return rest
    })
  }, [])

  // 保存单行草稿（铅笔或批量保存中调用）
  const handleSaveEdit = React.useCallback(async (
    row: T,
    opts?: { skipFetch?: boolean; suppressToast?: boolean }
  ) => {
    const idField = getIdField()
    const id = (row as any)[idField]
    const rowId = String(id)
    const currentEditingValues = draftValuesByRowRef.current[rowId]
    if (!currentEditingValues) return

    try {
      
      // 过滤掉未改变的字段，并处理日期字段和关系字段
      const updates: Record<string, any> = {}
      Object.entries(currentEditingValues).forEach(([key, value]) => {
        // 处理字段名映射：parent_id -> parent, manager_id -> manager, department_id -> department
        // 对于 unloaded_by 和 received_by，直接使用原字段名
        let fieldConfig = config.fields[key]
        if (!fieldConfig) {
          // 尝试映射字段名
          if (key === 'parent_id') {
            fieldConfig = config.fields['parent']
          } else if (key === 'manager_id') {
            fieldConfig = config.fields['manager']
          } else if (key === 'department_id') {
            fieldConfig = config.fields['department']
          } else if (key === 'unloaded_by' || key === 'received_by') {
            // unloaded_by 和 received_by 直接使用原字段名
            fieldConfig = config.fields[key]
          }
        }
        
        // 处理 boolean 字段：false 和 true 都是有效值
        if (fieldConfig?.type === 'boolean') {
          // boolean 字段：确保值是布尔类型
          // 注意：null/undefined 应该转换为 false，但需要明确处理
          let processedValue: boolean
          if (value === null || value === undefined) {
            processedValue = false
          } else if (typeof value === 'boolean') {
            processedValue = value
          } else if (typeof value === 'string') {
            processedValue = value === 'true' || value === '1'
          } else {
            processedValue = Boolean(value)
          }
          
          const originalValue = (row as any)[key]
          const originalBool = originalValue !== undefined && originalValue !== null ? Boolean(originalValue) : false
          
          // 比较处理后的值是否改变
          if (processedValue !== originalBool) {
            updates[key] = processedValue
            if (process.env.NODE_ENV === 'development') {
              console.log(`[EntityTable] Boolean字段 ${key} 更新:`, { original: originalBool, new: processedValue })
            }
          }
          return // 跳过后续处理
        }
        
        // 处理location字段：location字段在数据库中存储的是 ID，需要映射到正确的数据库字段名
        // 外键多为 BigInt：禁止 Number() 比较/提交（与 relation 字段 normalizeFk 一致）
        if (fieldConfig?.type === 'location') {
          let dbFieldName: string
          if (key === 'destination_location') {
            dbFieldName = 'location_id'
          } else if (key === 'location_id' || key === 'origin_location_id') {
            dbFieldName = key
          } else {
            dbFieldName = `${key}_id`
          }

          const normalizeLocId = (v: any): string | null => {
            if (v === null || v === undefined || v === '') return null
            const s = String(v).trim()
            if (s === '' || s === 'NaN') return null
            return s
          }

          const originalId =
            normalizeLocId((row as any)[dbFieldName]) ?? normalizeLocId((row as any)[key])

          let processedValue: string | null
          if (value === '' || value === null || value === undefined) {
            processedValue = null
          } else {
            processedValue = normalizeLocId(value)
          }

          const shouldUpdate =
            (processedValue ?? '') !== (originalId ?? '') ||
            (processedValue !== null && originalId === null) ||
            (processedValue === null && originalId !== null)

          if (shouldUpdate) {
            updates[dbFieldName] = processedValue
            if (process.env.NODE_ENV === 'development') {
              console.log(`[EntityTable] Location字段 ${key} -> ${dbFieldName} 更新:`, {
                original: originalId,
                new: processedValue,
              })
            }
          }
          return // 跳过后续处理
        }
        
        // 处理关系字段：关系字段在数据库中存储的是 ID，需要映射到正确的数据库字段名
        if (fieldConfig?.type === 'relation') {
          // 对于关系字段，需要确定数据库字段名
          // 优先使用 relationField（如果配置了）
          // 如果字段名以 _id 结尾，直接使用（如 user_id）
          // 否则，使用 {fieldKey}_id 作为数据库字段名（如 customer -> customer_id）
          // 特殊处理：unloaded_by 和 received_by 直接使用原字段名
          // 特殊处理：carrier 使用 carrier_id
          let dbFieldName: string
          if (fieldConfig.relationField) {
            dbFieldName = fieldConfig.relationField
          } else if (key === 'received_by' || key === 'unloaded_by') {
            dbFieldName = key // received_by 和 unloaded_by 直接使用原字段名（数据库字段都是 BigInt ID）
          } else if (key === 'carrier') {
            dbFieldName = 'carrier_id' // carrier 字段映射到 carrier_id
          } else if (key === 'loaded_by_name') {
            dbFieldName = 'loaded_by' // loaded_by_name 映射到 loaded_by
          } else if (key === 'trailer_code') {
            dbFieldName = 'trailer_code' // trailer_code 是文本字段，直接使用
          } else if (key.endsWith('_id')) {
            dbFieldName = key
          } else {
            dbFieldName = `${key}_id`
          }

          /** BigInt 外键必须用字符串比较/提交，禁止 Number()（超过 MAX_SAFE_INTEGER 会丢精度 → 误判「未修改」→ 整段更新被跳过） */
          const normalizeFk = (v: any): string | null => {
            if (v === null || v === undefined || v === '') return null
            const s = String(v).trim()
            if (s === '' || s === 'NaN') return null
            return s
          }

          // 处理空值：空字符串、null、undefined 都转换为 null
          let processedValue: string | number | null
          if (value === '' || value === null || value === undefined) {
            processedValue = null
          } else if (key === 'unloaded_by' || key === 'received_by' || key === 'loaded_by_name') {
            // unloaded_by, received_by, loaded_by_name 存储的是 BigInt ID，下拉框返回的是用户ID字符串
            // API 期望 string 类型，会转换为 BigInt
            processedValue = String(value)
          } else if (key === 'trailer_code') {
            // trailer_code 是文本字段，直接使用字符串值
            processedValue = String(value)
          } else {
            let v = value
            if (typeof v === 'object' && v !== null && key === 'carrier' && 'carrier_id' in (v as any)) {
              v = (v as any).carrier_id
            }
            processedValue = normalizeFk(v)
          }

          // 比较处理后的值是否改变
          let originalValue: string | number | null = null
          if (key === 'unloaded_by' || key === 'received_by' || key === 'loaded_by_name') {
            // unloaded_by, received_by, loaded_by_name 的原始值是 BigInt ID，API 返回的也是 ID
            const originalIdValue = (row as any)[dbFieldName] || (row as any)[key]
            originalValue = originalIdValue !== undefined && originalIdValue !== null ? String(originalIdValue) : null
          } else if (key === 'trailer_code') {
            // trailer_code 是文本字段，直接使用字符串值
            const originalTextValue = (row as any)[dbFieldName] || (row as any)['trailer_code']
            originalValue = originalTextValue !== undefined && originalTextValue !== null ? String(originalTextValue) : null
          } else {
            let oldStr = normalizeFk((row as any)[dbFieldName])
            if (oldStr === null && key === 'carrier' && (row as any).carrier?.carrier_id != null) {
              oldStr = normalizeFk((row as any).carrier.carrier_id)
            }
            if (oldStr === null && key === 'customer' && (row as any).customer?.id != null) {
              oldStr = normalizeFk((row as any).customer.id)
            }
            if (
              oldStr === null &&
              fieldConfig.relation?.model === 'locations' &&
              (row as any)[key] &&
              typeof (row as any)[key] === 'object' &&
              (row as any)[key].location_id != null
            ) {
              oldStr = normalizeFk((row as any)[key].location_id)
            }
            originalValue = oldStr
          }

          // locations 关联：草稿里若误为位置代码（非纯数字），无法用 delivery_location_id 提交，回退为当前行上的数字 ID
          let effectiveProcessed = processedValue
          if (
            fieldConfig.relation?.model === 'locations' &&
            effectiveProcessed != null &&
            String(effectiveProcessed).trim() !== '' &&
            !/^\d+$/.test(String(effectiveProcessed).trim())
          ) {
            if (originalValue != null && /^\d+$/.test(String(originalValue))) {
              effectiveProcessed = originalValue
            } else {
              effectiveProcessed = null
            }
          }
          
          // 对于 unloaded_by, received_by, loaded_by_name，如果新值不为 null，或者原始值为 null 但新值不为 null，都需要更新
          const shouldUpdate = effectiveProcessed !== originalValue || 
            (effectiveProcessed !== null && originalValue === null) ||
            (effectiveProcessed === null && originalValue !== null)
          
          if (shouldUpdate) {
            // 使用数据库字段名（如 carrier_id）而不是配置字段名（如 carrier）
            updates[dbFieldName] = effectiveProcessed
          }
          return // 跳过后续处理
        }
        
        // 处理日期字段：保持为 YYYY-MM-DD 字符串格式（API 会处理转换）
        let processedValue = value
        let dbFieldName = key // 默认使用原字段名
        if (fieldConfig?.type === 'date') {
          // 日期字符串格式：YYYY-MM-DD，保持字符串格式发送给 API
          // 空字符串转换为 null
          if (!value || value === '') {
            processedValue = null
          } else if (typeof value === 'string') {
            // 确保是 YYYY-MM-DD 格式（去掉时间部分）
            processedValue = value.split('T')[0]
          } else if (value instanceof Date) {
            // 如果是 Date 对象，转换为 YYYY-MM-DD 格式
            processedValue = value.toISOString().split('T')[0]
          }
        } else if (fieldConfig?.type === 'datetime') {
          // 日期时间字符串，保持字符串格式
          // 空字符串转换为 null
          if (!value || value === '') {
            processedValue = null
          } else if (typeof value === 'string') {
            processedValue = value
          } else if (value instanceof Date) {
            // 如果是 Date 对象，转换为 ISO 字符串
            processedValue = value.toISOString()
          }
        }
        
        // 处理 textarea 类型字段：空字符串转换为 null
        if (fieldConfig?.type === 'textarea') {
          if (processedValue === '' || processedValue === null || processedValue === undefined) {
            processedValue = null
          }
        }
        
        // 比较值是否改变
        const originalValue = (row as any)[key]
        
        // 对于日期字段，需要格式化原始值以便比较
        let originalStr = ''
        let newStr = ''
        
        if (fieldConfig?.type === 'date') {
          // 日期字段：将原始值格式化为 YYYY-MM-DD 格式
          if (originalValue === null || originalValue === undefined) {
            originalStr = ''
          } else if (originalValue instanceof Date) {
            originalStr = originalValue.toISOString().split('T')[0]
          } else if (typeof originalValue === 'string') {
            // 可能是 ISO 字符串或 YYYY-MM-DD 格式
            originalStr = originalValue.split('T')[0]
          } else {
            originalStr = String(originalValue)
          }
          
          newStr = processedValue === null || processedValue === undefined ? '' : String(processedValue)
          
          // 如果值改变了，使用正确的数据库字段名保存
          if (originalStr !== newStr) {
            updates[dbFieldName] = processedValue
          }
          return // 跳过后续处理
        } else if (fieldConfig?.type === 'datetime') {
          // 日期时间字段：保持原始格式
          if (originalValue === null || originalValue === undefined) {
            originalStr = ''
          } else if (originalValue instanceof Date) {
            originalStr = originalValue.toISOString()
          } else {
            originalStr = String(originalValue)
          }
          
          newStr = processedValue === null || processedValue === undefined ? '' : String(processedValue)
        } else {
          // 其他字段：直接转换为字符串比较
          originalStr = originalValue === null || originalValue === undefined ? '' : String(originalValue)
          newStr = processedValue === null || processedValue === undefined ? '' : String(processedValue)
        }
        
        if (originalStr !== newStr) {
          updates[key] = processedValue
        }
      })
      
      if (Object.keys(updates).length === 0) {
        clearDraftForRowId(rowId)
        if (!opts?.suppressToast) {
          toast.info('没有需要保存的更改')
        }
        return
      }
      
      // 如果提供了自定义保存处理函数，使用自定义逻辑
      if (customSaveHandler) {
        await customSaveHandler(row, updates)
        clearDraftForRowId(rowId)
        if (!opts?.suppressToast) {
          toast.success(`更新${config.displayName}成功`)
        }
        if (!opts?.skipFetch) {
          await fetchData(page, pageSize, sort, order, search, filterValues, advancedSearchValues, advancedSearchLogic)
        }
        return
      }
      
      // 默认保存逻辑：调用 API 更新
      // 添加调试日志
      if (process.env.NODE_ENV === 'development') {
        console.log(`[EntityTable] 更新 ${config.displayName} (${id}):`, updates)
        console.log(`[EntityTable] 发送的 JSON:`, JSON.stringify(updates))
      }
      
      let response: Response
      let responseText: string = ''
      
      try {
        response = await fetch(`${config.apiPath}/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        })
        
        // 先读取响应文本（只能读取一次）
        responseText = await response.text()
      } catch (fetchError: any) {
        console.error(`[EntityTable] 网络请求失败:`, fetchError)
        throw new Error(`网络请求失败: ${fetchError.message || '未知错误'}`)
      }
      
      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = responseText ? JSON.parse(responseText) : {}
        } catch (e) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}`, rawText: responseText }
        }
        
        // 显示详细的验证错误信息
        let errorMessage = errorData.error || `更新${config.displayName}失败`
        if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
          const detailMessages = errorData.details.map((d: any) => {
            const fieldLabel = config.fields[d.field]?.label || d.field
            return `${fieldLabel}: ${d.message}`
          }).join('; ')
          errorMessage = `${errorMessage}: ${detailMessages}`
        }
        console.error(`[EntityTable] 更新失败:`, {
          error: errorData,
          updates: updates,
          responseStatus: response.status,
          errorText: responseText
        })
        throw new Error(errorMessage)
      }
      
      // 响应成功，尝试解析响应数据并更新本地数据（如果API返回了更新后的数据）
      if (responseText) {
        try {
          const responseData = JSON.parse(responseText)
          console.log(`[EntityTable] 更新成功，响应数据:`, responseData)
          
          if (responseData.data) {
            const idFieldMerge = config.idField || 'id'
            const mergeRowId = String((row as any)[idFieldMerge])
            if (mergeRowId === rowId) {
              setData((prevData) => {
                const newData = prevData.map((item: any) => {
                  const itemId = String(item[idFieldMerge])
                  if (itemId === rowId) {
                    // 合并更新后的数据，保留原有数据，只更新返回的字段
                    const updatedItem = { ...item }
                    Object.keys(responseData.data).forEach(key => {
                      if (responseData.data[key] !== undefined) {
                        updatedItem[key] = responseData.data[key]
                      }
                    })
                    // 特别处理 boolean 字段，确保正确更新
                    if (responseData.data.verify_loading_sheet !== undefined) {
                      updatedItem.verify_loading_sheet = responseData.data.verify_loading_sheet === true
                    }
                    if (responseData.data.has_created_sheet !== undefined) {
                      updatedItem.has_created_sheet = responseData.data.has_created_sheet === true
                    }
                    if (responseData.data.can_create_sheet !== undefined) {
                      updatedItem.can_create_sheet = responseData.data.can_create_sheet === true
                    }
                    if (responseData.data.rejected !== undefined) {
                      updatedItem.rejected = responseData.data.rejected === true
                    }
                    // 更新 received_by 和 unloaded_by（API返回的是ID）
                    if (responseData.data.received_by !== undefined) {
                      updatedItem.received_by = responseData.data.received_by // ID
                    }
                    if (responseData.data.unloaded_by !== undefined) {
                      updatedItem.unloaded_by = responseData.data.unloaded_by // ID
                    }
                    // 更新 loaded_by 和 loaded_by_name（API返回的是ID和关联对象）
                    if (responseData.data.loaded_by !== undefined) {
                      updatedItem.loaded_by = responseData.data.loaded_by // ID
                    }
                    if (responseData.data.loaded_by_name !== undefined) {
                      updatedItem.loaded_by_name = responseData.data.loaded_by_name // 显示名称
                    }
                    // 更新关联对象（用于 relation 类型字段的显示）
                    if (responseData.data.users_outbound_shipments_loaded_byTousers !== undefined) {
                      updatedItem.users_outbound_shipments_loaded_byTousers = responseData.data.users_outbound_shipments_loaded_byTousers
                    }
                    // 更新 driver_name 和 driver_id（送仓司机）
                    if (responseData.data.driver_id !== undefined) {
                      updatedItem.driver_id = responseData.data.driver_id // ID
                    }
                    if (responseData.data.driver_name !== undefined) {
                      updatedItem.driver_name = responseData.data.driver_name // 显示名称
                    }
                    // 更新 rejected（拒收字段）
                    if (responseData.data.rejected !== undefined) {
                      updatedItem.rejected = responseData.data.rejected
                    }
                    // 更新三个 Boolean 字段（出库管理和预约管理）
                    if (responseData.data.verify_loading_sheet !== undefined) {
                      updatedItem.verify_loading_sheet = responseData.data.verify_loading_sheet === true
                    }
                    if (responseData.data.has_created_sheet !== undefined) {
                      updatedItem.has_created_sheet = responseData.data.has_created_sheet === true
                    }
                    if (responseData.data.can_create_sheet !== undefined) {
                      updatedItem.can_create_sheet = responseData.data.can_create_sheet === true
                    }
                    // 更新 location 字段（预约管理）
                    if (responseData.data.location_id !== undefined) {
                      updatedItem.location_id = responseData.data.location_id // ID
                    }
                    if (responseData.data.destination_location !== undefined) {
                      updatedItem.destination_location = responseData.data.destination_location // location_code 显示值
                    }
                    if (responseData.data.origin_location_id !== undefined) {
                      updatedItem.origin_location_id = responseData.data.origin_location_id // ID
                    }
                    if (responseData.data.origin_location !== undefined) {
                      updatedItem.origin_location = responseData.data.origin_location // location_code 显示值
                    }
                    // 更新关联对象（用于 location 类型字段的显示）
                    if (responseData.data.locations !== undefined) {
                      updatedItem.locations = responseData.data.locations
                    }
                    if (responseData.data.locations_delivery_appointments_origin_location_idTolocations !== undefined) {
                      updatedItem.locations_delivery_appointments_origin_location_idTolocations = responseData.data.locations_delivery_appointments_origin_location_idTolocations
                    }
                    return updatedItem
                  }
                  return item
                })
                return newData
              })
              clearDraftForRowId(rowId)
              if (!opts?.suppressToast) {
                toast.success(responseData.message || `更新${config.displayName}成功`)
              }
              if (!opts?.skipFetch) {
                await fetchData(page, pageSize, sort, order, search, filterValues, advancedSearchValues, advancedSearchLogic)
              }
              return
            }
          }
        } catch (e) {
          // 如果响应体不是有效的 JSON，忽略错误（更新可能仍然成功）
          console.warn(`[EntityTable] 响应解析警告（响应可能为空）:`, e, '响应文本:', responseText)
        }
      }
      
      clearDraftForRowId(rowId)
      if (!opts?.suppressToast) {
        toast.success(`更新${config.displayName}成功`)
      }
      if (!opts?.skipFetch) {
        try {
          await fetchData(page, pageSize, sort, order, search, filterValues, advancedSearchValues, advancedSearchLogic)
          console.log(`[EntityTable] 数据刷新完成`)
        } catch (refreshError) {
          console.error(`[EntityTable] 数据刷新失败:`, refreshError)
        }
      }
    } catch (error: any) {
      console.error(`[EntityTable] 更新${config.displayName}失败:`, error)
      console.error(`[EntityTable] 错误堆栈:`, error.stack)
      toast.error(error.message || `更新${config.displayName}失败`)
    }
  }, [clearDraftForRowId, config.apiPath, config.displayName, config.fields, config.idField, customSaveHandler, fetchData, page, pageSize, sort, order, search, filterValues, advancedSearchValues, advancedSearchLogic])
  
  const handleSaveAllDrafts = React.useCallback(async () => {
    if (draftRowIds.length === 0) return
    setSavingAllDrafts(true)
    try {
      const idField = getIdField()
      const snapshot = [...draftRowIds]
      let ok = 0
      let fail = 0
      for (const rid of snapshot) {
        const row = data.find((r) => String((r as any)[idField]) === rid)
        if (!row) {
          clearDraftForRowId(rid)
          continue
        }
        try {
          await handleSaveEdit(row, { skipFetch: true, suppressToast: true })
          ok++
        } catch {
          fail++
        }
      }
      await fetchData(page, pageSize, sort, order, search, filterValues, advancedSearchValues, advancedSearchLogic)
      if (fail === 0) {
        toast.success(ok > 0 ? `已保存 ${ok} 行修改` : '已保存')
      } else {
        toast.warning(`已保存 ${ok} 行，${fail} 行失败（请检查后重试）`)
      }
    } finally {
      setSavingAllDrafts(false)
    }
  }, [
    draftRowIds,
    data,
    getIdField,
    handleSaveEdit,
    fetchData,
    page,
    pageSize,
    sort,
    order,
    search,
    filterValues,
    advancedSearchValues,
    advancedSearchLogic,
    clearDraftForRowId,
  ])

  const handleUnifiedSaveDrafts = React.useCallback(async () => {
    if (isSavingAnyDrafts) return
    if (inlineEditEnabled && draftRowIds.length > 0) {
      await handleSaveAllDrafts()
    }
    if (pageDraftSave && pageDraftCount > 0) {
      await pageDraftSave.onSave()
    }
  }, [
    isSavingAnyDrafts,
    inlineEditEnabled,
    draftRowIds.length,
    handleSaveAllDrafts,
    pageDraftSave,
    pageDraftCount,
  ])

  // 取消编辑（清空所有草稿）
  const handleCancelEdit = React.useCallback(() => {
    draftValuesByRowRef.current = {}
    setDraftRowIds([])
    setActiveInlineFieldByRow({})
    setRowInlineEditScopeByRow({})
  }, [])

  // 处理查看详情
  const handleView = (item: T) => {
    try {
      const idField = getIdField()
      const id = (item as any)[idField]
      if (!id && id !== 0) {
        toast.error('无法获取ID，请刷新页面重试')
        return
      }
      const idString = String(id)
      const detailUrl = `${config.detailPath}/${idString}`
      router.push(detailUrl)
    } catch (error) {
      toast.error('查看详情失败，请刷新页面重试')
    }
  }

  // 处理删除
  const handleDelete = (item: T) => {
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }

  // 确认删除
  const confirmDelete = async () => {
    if (!itemToDelete) return
    
    try {
      const idField = getIdField()
      const id = (itemToDelete as any)[idField]
      const response = await fetch(`${config.apiPath}/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `删除${config.displayName}失败`)
      }
      
      toast.success(`删除${config.displayName}成功`)
      setDeleteDialogOpen(false)
      setItemToDelete(null)
      fetchData(page, pageSize, sort, order, search, filterValues, advancedSearchValues, advancedSearchLogic)
    } catch (error: any) {
      console.error(`删除${config.displayName}失败:`, error)
      toast.error(error.message || `删除${config.displayName}失败`)
    }
  }

  // 表单提交成功回调
  const handleFormSuccess = () => {
    setOpenDialog(false)
    setEditingItem(null)
    fetchData(page, pageSize, sort, order, search, filterValues, advancedSearchValues, advancedSearchLogic)
  }
  
  // 处理筛选变化
  const handleFilterChange = (field: string, value: any) => {
    setFilterValues((prev) => {
      const newFilters = { ...prev, [field]: value }
      // 如果值为空，删除该筛选
      if (value === null || value === undefined || value === '') {
        delete newFilters[field]
      }
      return newFilters
    })
    allowUrlSyncRef.current = true
    setPage(1)
  }

  const handleClearFilters = () => {
    allowUrlSyncRef.current = true
    setFilterValues({})
    setPage(1)
  }

  const applyFilterValues = React.useCallback((v: Record<string, any>) => {
    allowUrlSyncRef.current = true
    setFilterValues(v)
    setPage(1)
  }, [])
  
  // 处理高级搜索变化（仅更新状态）
  const handleAdvancedSearchChange = (field: string, value: any) => {
    setAdvancedSearchValues((prev) => {
      const newValues = { ...prev, [field]: value }
      // 如果值为空，删除该条件
      if (value === null || value === undefined || value === '') {
        delete newValues[field]
      }
      return newValues
    })
  }
  
  const handleAdvancedSearch = () => {
    allowUrlSyncRef.current = true
    setAdvancedSearchOpen(false)
    setPage(1)
  }

  const handleResetAdvancedSearch = () => {
    allowUrlSyncRef.current = true
    setAdvancedSearchValues({})
    setAdvancedSearchLogic('AND')
    setPage(1)
  }
  
  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRows.length === 0) {
      toast.error('请至少选择一条记录')
      return
    }
    
    try {
      const idField = getIdField()
      const ids = selectedRows.map(row => (row as any)[idField]).filter(Boolean)
      
      if (ids.length === 0) {
        toast.error('无法获取选中记录的ID')
        return
      }
      
      const response = await fetch(`${config.apiPath}/batch-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `批量删除${config.displayName}失败`)
      }
      
      toast.success(`成功删除 ${ids.length} 条${config.displayName}记录`)
      setBatchDeleteDialogOpen(false)
      setSelectedRows([])
      fetchData(page, pageSize, sort, order, search, filterValues, advancedSearchValues, advancedSearchLogic)
    } catch (error: any) {
      console.error(`批量删除${config.displayName}失败:`, error)
      toast.error(error.message || `批量删除${config.displayName}失败`)
    }
  }
  
  // 批量编辑提交
  const handleBatchEdit = async () => {
    if (selectedRows.length === 0) {
      toast.error('请至少选择一条记录')
      return
    }
    
    try {
      const idField = getIdField()
      const ids = selectedRows.map(row => (row as any)[idField]).filter(Boolean)
      
      if (ids.length === 0) {
        toast.error('无法获取选中记录的ID')
        return
      }
      
      // 处理 relation 字段：确保发送的是数字类型（ID）
      // 处理 boolean 字段：确保 false 值不被过滤掉
      // 处理字段名映射：parent_id -> parent_id, manager_id -> manager_id（保持原字段名用于API）
      const processedUpdates: Record<string, any> = {}
      Object.entries(batchEditValues).forEach(([key, value]) => {
        // 处理字段名映射：如果字段被映射了（如 parent_id -> parent），需要映射回数据库字段名
        // 对于 parent_id 和 manager_id，直接使用原字段名（数据库字段名）
        // 对于 unloaded_by 和 received_by，直接使用原字段名（数据库字段名）
        let dbFieldKey = key
        const fieldConfig = config.fields[key]
        
        // 如果找不到字段配置，可能是映射字段，尝试查找映射后的字段配置
        let actualFieldConfig = fieldConfig
        if (!fieldConfig) {
          if (key === 'parent_id') {
            actualFieldConfig = config.fields['parent']
          } else if (key === 'manager_id') {
            actualFieldConfig = config.fields['manager']
          } else if (key === 'department_id') {
            actualFieldConfig = config.fields['department']
          } else if (key === 'carrier') {
            actualFieldConfig = config.fields['carrier']
          } else if (key === 'unloaded_by' || key === 'received_by') {
            // unloaded_by 和 received_by 直接使用原字段名
            actualFieldConfig = config.fields[key]
          }
        }
        
        // 对于 boolean 字段，false 是有效值，不应该被过滤
        if (actualFieldConfig?.type === 'boolean') {
          // boolean 字段：false 和 true 都是有效值，只有 undefined 和 null 才过滤
          if (value !== undefined && value !== null) {
            processedUpdates[dbFieldKey] = Boolean(value)
          }
          return
        }
        
        // 对于其他字段，过滤掉空值
        if (value === null || value === undefined || value === '') {
          return
        }
        
        // 对于 location 字段，确保值是数字类型，并使用正确的数据库字段名
        if (actualFieldConfig?.type === 'location' && value) {
          const numValue = Number(value)
          if (!isNaN(numValue)) {
            // location 类型字段的数据库字段名通常是 {fieldKey}_id
            // 例外：destination_location -> location_id, location_id -> location_id, origin_location_id -> origin_location_id
            let finalDbFieldKey: string
            if (key === 'destination_location') {
              finalDbFieldKey = 'location_id'
            } else if (key === 'location_id' || key === 'origin_location_id') {
              // 如果 key 本身就是 _id 字段，直接使用
              finalDbFieldKey = key
            } else {
              finalDbFieldKey = `${key}_id`
            }
            processedUpdates[finalDbFieldKey] = numValue
          }
        }
        // 对于 relation 字段，确保值是数字类型，并使用正确的数据库字段名
        else if (actualFieldConfig?.type === 'relation' && value) {
          const numValue = Number(value)
          if (!isNaN(numValue)) {
            // 确定数据库字段名：优先使用 relationField，否则根据字段名规则确定
            let finalDbFieldKey: string
            if (actualFieldConfig.relationField) {
              finalDbFieldKey = actualFieldConfig.relationField
            } else if (key === 'unloaded_by' || key === 'received_by') {
              finalDbFieldKey = key // unloaded_by 和 received_by 直接使用原字段名
            } else if (key === 'carrier') {
              finalDbFieldKey = 'carrier_id' // carrier 字段映射到 carrier_id
            } else if (key.endsWith('_id')) {
              finalDbFieldKey = key
            } else {
              finalDbFieldKey = `${key}_id`
            }
            processedUpdates[finalDbFieldKey] = numValue
          }
        } else if (actualFieldConfig?.type === 'date' && value) {
          // 日期字段：处理日期格式
          // 确保是 YYYY-MM-DD 格式
          const dateValue = typeof value === 'string' ? value.split('T')[0] : value
          processedUpdates[dbFieldKey] = dateValue
        } else if (actualFieldConfig?.type === 'datetime' && value) {
          processedUpdates[dbFieldKey] =
            typeof value === 'string' ? value : value instanceof Date ? value.toISOString() : String(value)
        } else {
          processedUpdates[dbFieldKey] = value
        }
      })
      
      const updates = processedUpdates
      
      if (Object.keys(updates).length === 0) {
        toast.error('请至少填写一个要修改的字段')
        return
      }
      
      const response = await fetch(`${config.apiPath}/batch-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids, updates }),
      })
      
      if (!response.ok) {
        // 尝试解析错误响应，如果失败则使用状态文本
        let errorMessage = `批量编辑${config.displayName}失败`
        try {
          const responseText = await response.text()
          if (responseText) {
            try {
              const errorData = JSON.parse(responseText)
              errorMessage = errorData.error || errorMessage
            } catch {
              // 如果不是 JSON，使用原始文本
              errorMessage = responseText || errorMessage
            }
          } else {
            // 响应体为空，使用状态文本
            errorMessage = response.statusText || errorMessage
          }
        } catch (e) {
          // 解析失败，使用状态文本
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }
      
      toast.success(`成功更新 ${ids.length} 条${config.displayName}记录`)
      setBatchEditDialogOpen(false)
      setBatchEditValues({})
      setSelectedRows([])
      fetchData(page, pageSize, sort, order, search, filterValues, advancedSearchValues, advancedSearchLogic)
    } catch (error: any) {
      console.error(`批量编辑${config.displayName}失败:`, error)
      toast.error(error.message || `批量编辑${config.displayName}失败`)
    }
  }

  // 根据字段类型获取合适的列宽类（参考专业ERP系统标准）
  const getColumnWidthClass = (fieldKey: string, fieldConfig: any): string => {
    // ID列：最窄，通常不显示或隐藏
    if (fieldKey === 'id' && !fieldKey.includes('_id')) {
      return 'w-[80px]'
    }
    
    // 代码列：较窄，专业系统通常80-100px
    if (fieldKey === 'code' || fieldKey.includes('_code')) {
      return 'w-[100px]'
    }
    
    // 状态/Badge列：较窄，专业系统通常80-90px
    if (fieldConfig.type === 'badge') {
      return 'w-[90px]'
    }
    
    // 数字列：中等宽度，专业系统通常100-110px
    if (fieldConfig.type === 'number') {
      // 特殊处理容量等可能较长的数字
      if (fieldKey.includes('capacity') || fieldKey.includes('volume') || fieldKey.includes('weight')) {
        return 'w-[120px]'
      }
      return 'w-[100px]'
    }
    
    // 货币列：中等宽度，专业系统通常110-120px（考虑货币符号和千分位）
    if (fieldConfig.type === 'currency') {
      return 'w-[120px]'
    }
    
    // 日期列：中等宽度，专业系统通常110-120px
    if (fieldConfig.type === 'date') {
      return 'w-[120px]'
    }
    
    // 电话：中等宽度，专业系统通常130-140px
    if (fieldConfig.type === 'phone') {
      return 'w-[140px]'
    }
    
    // 邮箱：较宽，专业系统通常180-200px
    if (fieldConfig.type === 'email') {
      return 'w-[200px]'
    }
    
    // 关系列：根据具体类型设置
    if (fieldConfig.type === 'relation') {
      // 部门、用户等短关系：中等宽度
      if (fieldKey.includes('department') || fieldKey.includes('user') || fieldKey.includes('contact')) {
        return 'w-[130px]'
      }
      // 其他关系：较宽
      return 'w-[160px]'
    }
    
    // 名称列：最宽，专业系统通常200-250px
    if (fieldKey === 'name' || fieldKey === 'username') {
      return 'min-w-[220px]'
    }
    
    // 公司名称等：较宽
    if (fieldKey.includes('company') || fieldKey.includes('organization')) {
      return 'min-w-[200px]'
    }
    
    // 地址、描述等长文本：较宽
    if (fieldKey.includes('address') || fieldKey.includes('description') || fieldKey.includes('remark')) {
      return 'min-w-[220px]'
    }
    
    // 其他文本列：默认中等宽度
    return 'min-w-[160px]'
  }

  // 生成基础列定义（不包含操作列，操作列由框架自动添加）
  // 如果提供了自定义列，则使用自定义列；否则根据配置自动生成
  const baseColumns: ColumnDef<T>[] = React.useMemo(() => {
    if (customColumns) {
      // 如果提供了自定义列，需要为可编辑字段添加行级编辑支持
      return customColumns.map((col) => {
        const columnId = col.id || ((col as any).accessorKey as string)
        if (!columnId) return col
        
        // 获取字段配置
        // 处理字段名映射：parent_id -> parent, manager_id -> manager
        let actualFieldKey = columnId
        let fieldConfig = config.fields[columnId]
        if (!fieldConfig) {
          // 尝试映射字段名
          if (columnId === 'parent_id') {
            fieldConfig = config.fields['parent']
            actualFieldKey = 'parent'
          } else if (columnId === 'manager_id') {
            fieldConfig = config.fields['manager']
            actualFieldKey = 'manager'
          } else if (columnId === 'department') {
            fieldConfig = config.fields['department']
            actualFieldKey = 'department'
          } else if (columnId === 'department_id') {
            fieldConfig = config.fields['department']
            actualFieldKey = 'department'
          }
        }
        if (!fieldConfig) return col
        
        // 检查字段是否可编辑（需要检查原始字段名和映射后的字段名）
        // 对于 parent/manager/department，需要检查 parent_id/manager_id/department_id
        const editableFieldKey = (columnId === 'parent' && editableFields.includes('parent_id')) 
          ? 'parent_id' 
          : (columnId === 'manager' && editableFields.includes('manager_id'))
            ? 'manager_id'
            : (columnId === 'department' && editableFields.includes('department_id'))
              ? 'department_id'
              : columnId
        
        const isEditable = inlineEditEnabled && (
          editableFields.includes(columnId) || 
          editableFields.includes(actualFieldKey) ||
          editableFields.includes(editableFieldKey)
        )
        if (!isEditable) return col
        
        // 保存原始的 cell 渲染函数
        const originalCell = col.cell
        
        // 创建新的 cell 渲染函数，支持行级编辑
        const newCell = ({ row }: { row: any }) => {
          const rowId = String(row.original[getIdField()])
          const actualFieldKeyForEdit = (columnId === 'unloaded_by' || columnId === 'received_by')
            ? columnId
            : editableFields.includes(`${columnId}_id`) 
              ? `${columnId}_id` 
              : (columnId === 'parent' && editableFields.includes('parent_id'))
                ? 'parent_id'
                : (columnId === 'manager' && editableFields.includes('manager_id'))
                  ? 'manager_id'
                  : (columnId === 'department' && editableFields.includes('department_id'))
                    ? 'department_id'
                    : columnId
          const activeF = activeInlineFieldByRow[rowId]
          const shouldAutoOpenDropdown =
            activeF != null &&
            activeF !== '' &&
            (activeF === actualFieldKeyForEdit || activeF === columnId)
          const rowIsEditing = isMounted && isRowEditing(row.original)
          const draft = draftValuesByRowRef.current[rowId]
          const scope = rowInlineEditScopeByRow[rowId]
          const showThisColumnInline =
            rowIsEditing &&
            !fieldConfig.readonly &&
            (!scope ||
              scope.kind === 'all' ||
              (scope.kind === 'single' &&
                (scope.field === actualFieldKeyForEdit || scope.field === columnId)))

          if (showThisColumnInline) {
            const currentValue = draft?.[actualFieldKeyForEdit] !== undefined
              ? draft[actualFieldKeyForEdit]
              : draft?.[columnId] !== undefined
                ? draft[columnId]
                : row.getValue(columnId)

            const loadOptionsKeyForEdit = columnId === 'parent' ? 'parent_id' 
              : columnId === 'manager' ? 'manager_id'
              : columnId === 'department' ? 'department_id'
              : columnId === 'unloaded_by' ? 'unloaded_by'
              : columnId === 'received_by' ? 'received_by'
              : columnId
            const loadOptionsForEdit = fieldLoadOptions?.[loadOptionsKeyForEdit] || fieldLoadOptions?.[columnId]
            const loadFuzzyOptionsForEdit = fieldFuzzyLoadOptions?.[loadOptionsKeyForEdit] || fieldFuzzyLoadOptions?.[columnId]
            
            return (
              <InlineEditCell
                key={`${rowId}-${columnId}-${draftRowIds.join(',')}`}
                fieldKey={actualFieldKeyForEdit}
                fieldConfig={fieldConfig}
                value={currentValue}
                onChange={getFieldOnChange(rowId, actualFieldKeyForEdit)}
                loadOptions={loadOptionsForEdit}
                loadFuzzyOptions={loadFuzzyOptionsForEdit}
                autoOpenDropdown={shouldAutoOpenDropdown}
              />
            )
          }
          
          const openDraft = (e: React.MouseEvent) => {
            e.stopPropagation()
            if (!fieldConfig.readonly) handleStartEdit(row.original, actualFieldKeyForEdit)
          }
          const wrap = (node: React.ReactNode) => (
            <div
              role="button"
              tabIndex={0}
              className={inlineEditDisplayHitAreaClass(fieldConfig)}
              onClick={openDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openDraft(e as unknown as React.MouseEvent)
                }
              }}
            >
              {node}
            </div>
          )

          if (originalCell) {
            const content = typeof originalCell === 'function' 
              ? originalCell({ row } as any)
              : originalCell
            return fieldConfig.readonly || !inlineEditCellClickEnabled ? content : wrap(content)
          }
          
          const draftVal =
            draft?.[actualFieldKeyForEdit] !== undefined
              ? draft[actualFieldKeyForEdit]
              : draft?.[columnId] !== undefined
                ? draft[columnId]
                : undefined
          const value = draftVal !== undefined ? draftVal : row.getValue(columnId)
          
          if (fieldConfig.type === 'date') {
            const node = <div>{formatDateDisplay(value)}</div>
            return fieldConfig.readonly || !inlineEditCellClickEnabled ? node : wrap(node)
          }
          if (fieldConfig.type === 'datetime') {
            const node = <div>{formatDateTimeDisplay(value)}</div>
            return fieldConfig.readonly || !inlineEditCellClickEnabled ? node : wrap(node)
          }
          const node = <div>{value || '-'}</div>
          return fieldConfig.readonly || !inlineEditCellClickEnabled ? node : wrap(node)
        }
        
        // 返回新的列定义，使用新的 cell 渲染函数
        return {
          ...col,
          cell: newCell,
        }
      })
    }
    
    // 过滤掉审计字段（ID、created_by、updated_by、created_at、updated_at）
    const displayColumns = filterAuditFields(config.list.columns, config.idField)
    
    return displayColumns.map((fieldKey) => {
    // 处理字段名映射：parent_id -> parent, manager_id -> manager
    let actualFieldKey = fieldKey
    let fieldConfig = config.fields[fieldKey]
    
    if (!fieldConfig) {
      // 尝试映射字段名
      if (fieldKey === 'parent_id') {
        fieldConfig = config.fields['parent']
        actualFieldKey = 'parent'
      } else if (fieldKey === 'manager_id') {
        fieldConfig = config.fields['manager']
        actualFieldKey = 'manager'
      } else if (fieldKey === 'department') {
        fieldConfig = config.fields['department']
        actualFieldKey = 'department'
      } else if (fieldKey === 'department_id') {
        fieldConfig = config.fields['department']
        actualFieldKey = 'department'
      } else if (fieldKey === 'location_id') {
        // location_id 映射到 destination_location 字段配置
        fieldConfig = config.fields['destination_location']
        actualFieldKey = 'destination_location'
      } else if (fieldKey === 'origin_location_id') {
        // origin_location_id 映射到 origin_location 字段配置
        fieldConfig = config.fields['origin_location']
        actualFieldKey = 'origin_location'
      }
    }
    
    if (!fieldConfig) return null

    const column: ColumnDef<T> = {
      accessorKey: fieldKey,
      header: fieldConfig.label,
      enableSorting: fieldConfig.sortable || false,
      enableHiding: true, // 允许隐藏列
      meta: {
        widthClass: getColumnWidthClass(fieldKey, fieldConfig),
        alignRight: fieldConfig.type === 'number' || fieldConfig.type === 'currency',
      },
    }
    

    // 自定义 cell 渲染（根据字段类型和编辑状态）
    // actualFieldKey 已经在上面定义过了，这里直接使用
    
    // 检查字段是否可编辑（需要检查原始字段名和映射后的字段名）
    // 对于 parent/manager/department/location，需要同时检查原始字段名和 _id 字段名
    const isEditable = inlineEditEnabled && (
      editableFields.includes(fieldKey) || 
      editableFields.includes(actualFieldKey) ||
      (fieldKey === 'parent' && editableFields.includes('parent_id')) ||
      (fieldKey === 'manager' && editableFields.includes('manager_id')) ||
      (fieldKey === 'department' && editableFields.includes('department_id')) ||
      (fieldKey === 'destination_location' && editableFields.includes('location_id')) ||
      (fieldKey === 'origin_location' && editableFields.includes('origin_location_id')) ||
      (actualFieldKey === 'parent' && editableFields.includes('parent_id')) ||
      (actualFieldKey === 'manager' && editableFields.includes('manager_id')) ||
      (actualFieldKey === 'department' && editableFields.includes('department_id')) ||
      (actualFieldKey === 'destination_location' && editableFields.includes('location_id')) ||
      (actualFieldKey === 'origin_location' && editableFields.includes('origin_location_id'))
    )
    
    // 确定编辑时使用的字段名（用于 onChange）
    const editableFieldKey = (fieldKey === 'parent' && editableFields.includes('parent_id')) 
      ? 'parent_id' 
      : (fieldKey === 'parent' && editableFields.includes('parent'))
        ? 'parent'
        : (fieldKey === 'manager' && editableFields.includes('manager_id'))
          ? 'manager_id'
          : (fieldKey === 'manager' && editableFields.includes('manager'))
            ? 'manager'
            : (fieldKey === 'department' && editableFields.includes('department_id'))
              ? 'department_id'
              : (fieldKey === 'department' && editableFields.includes('department'))
                ? 'department'
                : (fieldKey === 'destination_location' && editableFields.includes('location_id'))
                  ? 'location_id'
                  : (fieldKey === 'origin_location' && editableFields.includes('origin_location_id'))
                    ? 'origin_location_id'
                    : fieldKey
    
    // 创建 cell 渲染函数
    const createCellRenderer = () => {
      return ({ row }: { row: any }) => {
        if (customCellRenderers?.[fieldKey]) {
          return <>{customCellRenderers[fieldKey]!({ row })}</>
        }
        const rowId = String(row.original[getIdField()])
        // 与 editableFieldKey / 草稿、handleStartEdit(focus) 一致（含 destination/origin 等映射）
        const draftFieldKey = editableFieldKey
        const activeF = activeInlineFieldByRow[rowId]
        const shouldAutoOpenDropdown =
          activeF != null &&
          activeF !== '' &&
          (activeF === draftFieldKey ||
            activeF === fieldKey ||
            activeF === actualFieldKey)
        const rowInDraft = isMounted && isRowEditing(row.original)
        const scope = rowInlineEditScopeByRow[rowId]
        const showThisColumnInline =
          rowInDraft &&
          !fieldConfig.readonly &&
          isEditable &&
          (!scope ||
            scope.kind === 'all' ||
            (scope.kind === 'single' &&
              (scope.field === draftFieldKey ||
                scope.field === fieldKey ||
                scope.field === actualFieldKey)))

        const wrapIfEditable = (node: React.ReactNode) => {
          if (!isEditable || fieldConfig.readonly || !inlineEditCellClickEnabled) return <>{node}</>
          return (
            <div
              role="button"
              tabIndex={0}
              className={inlineEditDisplayHitAreaClass(fieldConfig)}
              onClick={(e) => {
                e.stopPropagation()
                handleStartEdit(row.original, draftFieldKey)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleStartEdit(row.original, draftFieldKey)
                }
              }}
            >
              {node}
            </div>
          )
        }
        
        if (showThisColumnInline) {
          let initialValue = row.getValue(fieldKey)
          
          // 对于location字段，从 _id 字段读取ID值
          if (fieldConfig.type === 'location') {
            // location类型字段的数据库字段名通常是 {fieldKey}_id
            // 例外：destination_location -> location_id, location_id -> location_id, origin_location_id -> origin_location_id
            let idKey: string
            if (fieldKey === 'destination_location') {
              idKey = 'location_id'
            } else if (fieldKey === 'location_id' || fieldKey === 'origin_location_id') {
              // 如果 fieldKey 本身就是 _id 字段，直接使用
              idKey = fieldKey
            } else {
              idKey = `${fieldKey}_id`
            }
            const idValue = (row.original as any)[idKey]
            // 优先使用 _id 字段的值（这是实际的 ID）
            if (idValue !== undefined && idValue !== null) {
              initialValue = String(idValue)
            }
          } else if (fieldConfig.type === 'relation') {
            // 对于关系字段，确定数据库字段名
            // 优先使用 relationField（如果配置了）
            // 对于 parent_id、manager_id 和 department_id，直接使用 fieldKey 作为 idKey
            // 对于 department，使用 department_id
            // 对于 unloaded_by 和 received_by，直接使用原字段名
            let idKey: string
            if (fieldConfig.relationField) {
              // 如果配置了 relationField（如 driver_name 的 relationField 是 driver_id），使用它
              idKey = fieldConfig.relationField
              const idValue = (row.original as any)[idKey]
              if (idValue !== undefined && idValue !== null) {
                initialValue = String(idValue)
              } else {
                initialValue = null
              }
            } else if (fieldKey === 'unloaded_by') {
              // unloaded_by 在数据库中存储的是 BigInt ID，API 返回的也是 ID
              idKey = 'unloaded_by'
              const idValue = (row.original as any)[idKey]
              if (idValue !== undefined && idValue !== null) {
                initialValue = String(idValue)
              } else {
                initialValue = null
              }
            } else if (fieldKey === 'received_by') {
              // received_by 在数据库中存储的是 BigInt ID，API 返回的也是 ID
              idKey = 'received_by'
              const idValue = (row.original as any)[idKey]
              if (idValue !== undefined && idValue !== null) {
                initialValue = String(idValue)
              } else {
                initialValue = null
              }
            } else if (fieldKey === 'parent_id' || fieldKey === 'manager_id' || fieldKey === 'department_id' || fieldKey === 'carrier_id') {
              idKey = fieldKey
              const idValue = (row.original as any)[idKey]
              if (idValue !== undefined && idValue !== null) {
                initialValue = String(idValue)
              }
            } else if (fieldKey === 'department') {
              idKey = 'department_id'
              const idValue = (row.original as any)[idKey]
              if (idValue !== undefined && idValue !== null) {
                initialValue = String(idValue)
              }
            } else if (fieldKey === 'carrier') {
              idKey = 'carrier_id'
              const idValue = (row.original as any)[idKey]
              if (idValue !== undefined && idValue !== null) {
                initialValue = String(idValue)
              }
            } else if (fieldKey === 'loaded_by_name') {
              // loaded_by_name 映射到 loaded_by
              idKey = 'loaded_by'
              const idValue = (row.original as any)[idKey]
              if (idValue !== undefined && idValue !== null) {
                initialValue = String(idValue)
              } else {
                initialValue = null
              }
            } else {
              idKey = `${fieldKey}_id`
              const idValue = (row.original as any)[idKey]
              if (idValue !== undefined && idValue !== null) {
                initialValue = String(idValue)
              } else if (initialValue && typeof initialValue === 'string') {
                // 如果 initialValue 是字符串（可能是显示值），尝试从关联数据中获取 ID
                // 这种情况通常不会发生，因为 API 应该返回 _id 字段
                initialValue = initialValue
              }
            }
          } else if (fieldConfig.type === 'date') {
            // 对于日期字段，格式化为 YYYY-MM-DD 格式
            if (initialValue === null || initialValue === undefined) {
              initialValue = null
            } else if (initialValue instanceof Date) {
              initialValue = initialValue.toISOString().split('T')[0]
            } else if (typeof initialValue === 'string') {
              // 可能是 ISO 字符串或 YYYY-MM-DD 格式
              initialValue = initialValue.split('T')[0]
            }
          } else if (fieldConfig.type === 'datetime') {
            // 对于日期时间字段，格式化为 ISO 字符串
            if (initialValue === null || initialValue === undefined) {
              initialValue = null
            } else if (initialValue instanceof Date) {
              initialValue = initialValue.toISOString()
            }
          }
          
          const actualFieldKeyForEdit = draftFieldKey
          
          // 获取字段的 loadOptions 和 loadFuzzyOptions 函数（如果提供）
          // 注意：fieldLoadOptions 的 key 可能是 parent_id/manager_id/department_id/unloaded_by/received_by/carrier_id
          // 但也可能直接使用 parent/manager/department/carrier
          const loadOptionsKey = actualFieldKeyForEdit === 'parent_id' ? 'parent_id' 
            : actualFieldKeyForEdit === 'parent' ? ('parent_id' in (fieldLoadOptions || {}) ? 'parent_id' : 'parent')
            : actualFieldKeyForEdit === 'manager_id' ? 'manager_id'
            : actualFieldKeyForEdit === 'manager' ? ('manager_id' in (fieldLoadOptions || {}) ? 'manager_id' : 'manager')
            : actualFieldKeyForEdit === 'department_id' ? 'department_id'
            : actualFieldKeyForEdit === 'department' ? ('department_id' in (fieldLoadOptions || {}) ? 'department_id' : 'department')
            : actualFieldKeyForEdit === 'unloaded_by' ? 'unloaded_by'
            : actualFieldKeyForEdit === 'received_by' ? 'received_by'
            : actualFieldKeyForEdit === 'carrier_id' ? 'carrier_id'
            : fieldKey === 'carrier' ? 'carrier' // carrier 字段也支持
            : fieldKey
          const loadOptions = fieldLoadOptions?.[loadOptionsKey] || fieldLoadOptions?.[fieldKey] || (actualFieldKeyForEdit === 'department' ? fieldLoadOptions?.['department_id'] : undefined)
          const loadFuzzyOptions = fieldFuzzyLoadOptions?.[loadOptionsKey] || fieldFuzzyLoadOptions?.[fieldKey] || (actualFieldKeyForEdit === 'department' ? fieldFuzzyLoadOptions?.['department_id'] : undefined)
          
          // 对于关系字段，如果没有 loadOptions 和 loadFuzzyOptions，尝试使用 select 类型渲染
          const effectiveType = fieldConfig.type === 'relation' && !loadOptions && !loadFuzzyOptions && fieldConfig.options
            ? 'select'
            : fieldConfig.type

          const draft = draftValuesByRowRef.current[rowId]
          if (draft) {
            if (draft[actualFieldKeyForEdit] !== undefined) {
              initialValue = draft[actualFieldKeyForEdit]
            } else if (draft[fieldKey] !== undefined) {
              initialValue = draft[fieldKey]
            }
          }
          
          return (
            <InlineEditCell
              key={`${rowId}-${fieldKey}-${draftRowIds.join(',')}`}
              fieldKey={actualFieldKeyForEdit}
              fieldConfig={{ ...fieldConfig, type: effectiveType as any }}
              value={initialValue}
              onChange={getFieldOnChange(rowId, actualFieldKeyForEdit)}
              loadOptions={loadOptions}
              loadFuzzyOptions={loadFuzzyOptions}
              autoOpenDropdown={shouldAutoOpenDropdown}
            />
          )
        }
        
        // 显示模式：根据字段类型渲染（可编辑列点击单元格进入与铅笔一致的草稿编辑）
        const draftSnap = draftValuesByRowRef.current[rowId]
        const dPref =
          draftSnap == null
            ? undefined
            : draftSnap[draftFieldKey] !== undefined
              ? draftSnap[draftFieldKey]
              : draftSnap[fieldKey] !== undefined
                ? draftSnap[fieldKey]
                : undefined

        if (fieldConfig.type === 'badge') {
          const value = (dPref !== undefined ? dPref : row.getValue(fieldKey)) as string
          return wrapIfEditable(
            <Badge variant={value === 'active' ? 'default' : 'secondary'}>
              {fieldConfig.options?.find(opt => opt.value === value)?.label || value}
            </Badge>
          )
        }
        if (fieldConfig.type === 'select') {
          const value = (dPref !== undefined ? dPref : row.getValue(fieldKey)) as string
          const option = fieldConfig.options?.find(opt => opt.value === value)
          const displayText = option?.label || value || '-'
          const isRedText = fieldKey === 'delivery_nature' && value === '扣货'
          return wrapIfEditable(
            <div className={isRedText ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
              {displayText}
            </div>
          )
        }
        if (fieldConfig.type === 'currency') {
          const value = dPref !== undefined ? dPref : row.getValue(fieldKey)
          if (!value && value !== 0) return wrapIfEditable(<div className="text-muted-foreground">-</div>)
          const numValue = typeof value === 'number' ? value : parseFloat(String(value))
          if (isNaN(numValue)) return wrapIfEditable(<div className="text-muted-foreground">-</div>)
          return wrapIfEditable(
            <div className="font-medium">
              ${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )
        }
        
        if (fieldConfig.type === 'date') {
          const value = dPref !== undefined ? dPref : row.getValue(fieldKey)
          return wrapIfEditable(<div>{formatDateDisplay(value)}</div>)
        }
        
        if (fieldConfig.type === 'datetime') {
          const value = dPref !== undefined ? dPref : row.getValue(fieldKey)
          return wrapIfEditable(<div>{formatDateTimeDisplay(value)}</div>)
        }
        
        if (fieldConfig.type === 'location') {
          return (
            <LocationInlineDisplayCell
              row={row}
              fieldKey={fieldKey}
              fieldConfig={fieldConfig}
              dPref={dPref}
              wrapIfEditable={wrapIfEditable}
            />
          )
        }
        
        if (fieldConfig.type === 'relation') {
          const loadOptionsKeyForDraft =
            draftFieldKey === 'parent_id'
              ? 'parent_id'
              : draftFieldKey === 'parent'
                ? 'parent_id' in (fieldFuzzyLoadOptions || {})
                  ? 'parent_id'
                  : 'parent'
                : draftFieldKey === 'manager_id'
                  ? 'manager_id'
                  : draftFieldKey === 'manager'
                    ? 'manager_id' in (fieldFuzzyLoadOptions || {})
                      ? 'manager_id'
                      : 'manager'
                    : draftFieldKey === 'department_id'
                      ? 'department_id'
                      : draftFieldKey === 'department'
                        ? 'department_id' in (fieldFuzzyLoadOptions || {})
                          ? 'department_id'
                          : 'department'
                        : draftFieldKey === 'unloaded_by'
                          ? 'unloaded_by'
                          : draftFieldKey === 'received_by'
                            ? 'received_by'
                            : draftFieldKey === 'carrier_id'
                              ? 'carrier_id'
                              : fieldKey === 'carrier'
                                ? 'carrier'
                                : draftFieldKey

          const loadFuzzyForDraft =
            fieldFuzzyLoadOptions?.[loadOptionsKeyForDraft] ||
            fieldFuzzyLoadOptions?.[fieldKey] ||
            (draftFieldKey === 'department' ? fieldFuzzyLoadOptions?.['department_id'] : undefined)

          const renderRelationCommitted = () => {
            // 直接从 row.original 获取值，确保获取到的是原始数据
            const originalValue = (row.original as any)[fieldKey]

            // 如果 value 是对象，尝试获取 displayField
            if (originalValue && typeof originalValue === 'object') {
              const displayValue = fieldConfig.relation?.displayField
                ? (originalValue as any)?.[fieldConfig.relation.displayField]
                : originalValue
              return wrapIfEditable(<div>{displayValue || '-'}</div>)
            }

            // value 是 ID（数字或字符串）或 null/undefined，从关联数据中获取显示值
            let relationData = null

            const possibleKeys: string[] = [
              fieldKey === 'loaded_by_name' ? 'users_outbound_shipments_loaded_byTousers' : null,
              `users_inbound_receipt_${fieldKey}Tousers`,
              `users_outbound_shipments_${fieldKey}Tousers`,
              `users_${fieldKey}Tousers`,
              fieldConfig.relation?.model === 'users' && fieldKey === 'loaded_by_name'
                ? `users_outbound_shipments_loaded_byTousers`
                : null,
              fieldConfig.relation?.model === 'users' && fieldKey !== 'loaded_by_name'
                ? `users_outbound_shipments_${fieldKey}Tousers`
                : null,
              fieldConfig.relation?.model === 'trailers' ? 'trailers' : null,
              fieldConfig.relation?.model === 'drivers' ? 'drivers' : null,
              fieldConfig.relation?.model === 'carriers' ? 'carrier' : null,
              fieldConfig.relation?.model === 'customers' ? 'customer' : null,
            ].filter((key): key is string => key !== null && typeof key === 'string')

            for (const key of possibleKeys) {
              if ((row.original as any)[key]) {
                relationData = (row.original as any)[key]
                break
              }
            }

            if (!relationData && fieldConfig.relation?.model) {
              let modelKey: string | null = null
              if (fieldConfig.relation.model === 'users') {
                modelKey = fieldKey === 'loaded_by_name' ? 'users_outbound_shipments_loaded_byTousers' : null
              } else if (fieldConfig.relation.model === 'trailers') {
                modelKey = 'trailers'
              } else if (fieldConfig.relation.model === 'drivers') {
                modelKey = 'drivers'
              } else if (fieldConfig.relation.model === 'carriers') {
                modelKey = 'carrier'
              } else if (fieldConfig.relation.model === 'customers') {
                modelKey = 'customer'
              }
              if (modelKey && (row.original as any)[modelKey]) {
                relationData = (row.original as any)[modelKey]
              }
            }

            if (relationData) {
              const displayField = fieldConfig.relation?.displayField || 'full_name'
              const displayValue =
                relationData[displayField] ||
                relationData.full_name ||
                relationData.username ||
                relationData.trailer_code ||
                relationData.driver_code
              if (displayValue) {
                return wrapIfEditable(<div>{displayValue}</div>)
              }
            }

            if (originalValue && typeof originalValue === 'string') {
              return wrapIfEditable(<div>{originalValue}</div>)
            }

            if (!originalValue) {
              return wrapIfEditable(<div>-</div>)
            }

            return wrapIfEditable(<div>{String(originalValue)}</div>)
          }

          if (dPref !== undefined) {
            return (
              <RelationInlineDraftRowDisplay
                rowOriginal={row.original as any}
                fieldKey={fieldKey}
                fieldConfig={fieldConfig}
                draftRaw={dPref}
                loadFuzzyOptions={loadFuzzyForDraft}
                wrapIfEditable={wrapIfEditable}
                renderCommitted={renderRelationCommitted}
              />
            )
          }

          return renderRelationCommitted()
        }
        
        if (fieldConfig.type === 'boolean') {
          const value = dPref !== undefined ? dPref : row.getValue(fieldKey)
          const boolValue = value === true || value === 'true' || value === 1 || value === '1'
          // 如果正在编辑但字段是只读的，显示为只读文本
          if (rowInDraft && fieldConfig.readonly) {
            return <div className="text-sm">{boolValue ? '是' : '否'}</div>
          }
          return wrapIfEditable(
            <div className="flex items-center justify-center">
              {boolValue ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
            </div>
          )
        }
        
        // 特殊处理：未约板数 < 0 时红色显示
        if (fieldKey === 'unbooked_pallet_count' || fieldKey === 'unbooked_pallets') {
          const value = dPref !== undefined ? dPref : row.getValue(fieldKey)
          const numValue = typeof value === 'number' ? value : (value !== null && value !== undefined ? parseFloat(String(value)) : null)
          const isNegative = numValue !== null && !isNaN(numValue) && numValue < 0
          return wrapIfEditable(
            <div className={isNegative ? 'text-red-600 font-semibold' : ''}>
              {numValue !== null && !isNaN(numValue) ? numValue.toLocaleString() : '-'}
            </div>
          )
        }
        
        // 特殊处理：位置登记（仅入库管理列表，前端根据子表明细 inventory_lots 的仓库位置是否有值动态计算，不落库）
        if (fieldKey === 'location_registration') {
          const rowData = row.original as any
          const lots: any[] = rowData.inventory_lots || []
          const hasLots = lots.length > 0
          const allHaveLocation = hasLots && lots.every(
            (lot: any) => lot.storage_location_code != null && String(lot.storage_location_code).trim() !== ''
          )
          const completed = hasLots && allHaveLocation
          return (
            <span className={completed ? '' : 'text-red-600 dark:text-red-400 font-medium'}>
              {completed ? '已完成' : '未完成'}
            </span>
          )
        }
        
        // 特殊处理：送货进度
        // 对于库存明细（inventory_lots）：与 computeInboundOrderDetailDeliveryState 一致，剩余板数≤0 则 100%
        // 对于入库管理（inbound_receipts）：直接显示 API 返回的计算值（与详情预约口径一致）
        if (fieldKey === 'delivery_progress') {
          const rowData = row.original as any
          
          // 判断是否为库存明细表（有 pallet_count 和 remaining_pallet_count 字段）
          const isInventoryLot = rowData.pallet_count !== undefined && rowData.remaining_pallet_count !== undefined
          
          let progress = 0
          
          if (isInventoryLot) {
            const palletCount = rowData.pallet_count ?? 0
            const remainingCount = rowData.remaining_pallet_count ?? 0
            if (remainingCount <= 0) {
              progress = 100
            } else if (palletCount > 0) {
              const deliveredCount = palletCount - remainingCount
              progress = (deliveredCount / palletCount) * 100
              progress = Math.round(progress * 100) / 100
              progress = Math.max(0, Math.min(100, progress))
            } else {
              progress = 0
            }
          } else {
            // 入库管理：直接使用 API 返回的值（已按板数加权平均计算）
            const value = row.getValue(fieldKey)
            if (value === null || value === undefined) {
              progress = 0
            } else {
              progress = typeof value === 'number' ? value : parseFloat(String(value))
              if (isNaN(progress)) progress = 0
              // 确保进度在 0-100 之间
              progress = Math.max(0, Math.min(100, progress))
            }
          }
          
          const isComplete = progress >= 100
          
          return (
            <div className="flex items-center gap-3 min-w-[140px]">
              {/* 进度条 */}
              <div className="flex-1 relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isComplete
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              {/* 百分比文字 */}
              <span 
                className={`text-sm font-semibold min-w-[50px] text-right ${
                  isComplete 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-foreground'
                }`}
              >
                {progress.toFixed(0)}%
              </span>
            </div>
          )
        }
        
        if (fieldConfig.type === 'number') {
          const value = dPref !== undefined ? dPref : row.getValue(fieldKey)
          if (value === null || value === undefined) {
            return wrapIfEditable(<div className="text-muted-foreground">-</div>)
          }
          const numValue = typeof value === 'number' ? value : parseFloat(String(value))
          if (isNaN(numValue)) {
            return wrapIfEditable(<div className="text-muted-foreground">-</div>)
          }
          if (fieldKey === 'capacity_cbm' || fieldKey === 'container_volume') {
            return wrapIfEditable(<div>{numValue.toLocaleString()} CBM</div>)
          }
          return wrapIfEditable(<div>{numValue.toLocaleString()}</div>)
        }
        
        const value = dPref !== undefined ? dPref : row.getValue(fieldKey)
        return wrapIfEditable(<div>{value?.toString() || '-'}</div>)
      }
    }
    
    // 应用 cell 渲染器
    column.cell = createCellRenderer()

      return column
    }).filter(Boolean) as ColumnDef<T>[]
  }, [
    customColumns,
    config.list.columns,
    config.idField,
    config.fields,
    inlineEditEnabled,
    editableFields,
    isMounted,
    isRowEditing,
    draftRowIds,
    activeInlineFieldByRow,
    rowInlineEditScopeByRow,
    handleEditValueChange,
    getFieldOnChange,
    handleStartEdit,
    fieldLoadOptions,
    fieldFuzzyLoadOptions,
    getIdField,
    customCellRenderers,
    inlineEditCellClickEnabled,
  ])

  // 使用新框架创建表格配置
  const tableConfig = React.useMemo(() => {
    // 获取可排序列（如果提供了自定义，则使用自定义；否则根据字段配置）
    // 先过滤掉审计字段，再筛选可排序列
    const displayColumns = filterAuditFields(config.list.columns, config.idField)
    const sortableColumns = customSortableColumns || displayColumns.filter(fieldKey => {
      const fieldConfig = config.fields[fieldKey]
      return fieldConfig?.sortable
    })

    // 创建列标签映射（如果提供了自定义，则使用自定义；否则根据配置生成）
    // 使用上面已经过滤好的 displayColumns
    const columnLabels = customColumnLabels || Object.fromEntries(
      displayColumns.map(fieldKey => {
        const fieldConfig = config.fields[fieldKey]
        return [fieldKey, fieldConfig?.label || fieldKey]
      })
    )

    // 检查是否有删除权限
    const hasDeletePermission = config.permissions.delete && config.permissions.delete.length > 0
    
    // 使用自定义操作或默认操作
    // 如果 customActions.onView 是 undefined，则使用默认的 handleView；如果是 null，则隐藏查看详情按钮
    // 如果 customActions.onDelete 是 undefined，则使用默认的 handleDelete；如果是 null，则隐藏删除按钮
    const actionsConfig = customActions ? {
      onView: customActions.onView === null ? undefined : (customActions.onView !== undefined ? customActions.onView : handleView),
      onDelete: customActions.onDelete === null 
        ? undefined 
        : (customActions.onDelete !== undefined ? customActions.onDelete : (hasDeletePermission ? handleDelete : undefined)),
      // 如果自定义操作没有提供行内编辑，则使用默认的
      onEdit: inlineEditEnabled ? handleStartEdit : undefined,
      onSave: inlineEditEnabled ? handleSaveEdit : undefined,
      onCancelEdit: inlineEditEnabled ? handleCancelEdit : undefined,
      isEditing: inlineEditEnabled ? isRowEditing : undefined,
    } : {
      onView: handleView,
      onDelete: hasDeletePermission ? handleDelete : undefined,
      // 行内编辑功能
      onEdit: inlineEditEnabled ? handleStartEdit : undefined,
      onSave: inlineEditEnabled ? handleSaveEdit : undefined,
      onCancelEdit: inlineEditEnabled ? handleCancelEdit : undefined,
      isEditing: inlineEditEnabled ? isRowEditing : undefined,
    }

    try {
      return createStandardTableConfig<T>({
        columns: baseColumns,
        sortableColumns,
        columnLabels,
        showActions: true,
        actionsConfig,
        clickableColumns: customClickableColumns,
      })
    } catch (error) {
      console.error('创建表格配置失败:', error)
      // 如果失败，返回基础配置，不包含操作列
      return {
        columns: baseColumns,
        sortableColumns,
        columnLabels,
      }
    }
  }, [
    baseColumns, 
    config.list.columns, 
    config.fields, 
    handleView, 
    handleDelete, 
    customSortableColumns, 
    customColumnLabels, 
    customActions,
    inlineEditEnabled,
    editableFields,
    isMounted,
    isRowEditing,
    draftRowIds,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleEditValueChange,
  ])

  const { columns, sortableColumns, columnLabels } = tableConfig

  // 获取搜索占位符（使用第一个可搜索字段）
  const searchPlaceholder = config.list.searchFields && config.list.searchFields.length > 0
    ? `搜索${config.list.searchFields.map(field => config.fields[field]?.label || field).join('、')}...`
    : '搜索...'

  return (
    <div className="space-y-3 px-3">
      {/* 页面头部（紧凑，突出下方表格主区域） */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1 flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {config.pluralName?.endsWith('管理') ? config.pluralName : `${config.pluralName}管理`}
          </h1>
          <p className="text-sm text-muted-foreground leading-snug max-w-2xl">
            管理系统中所有{config.pluralName}信息，支持搜索、筛选和批量操作
          </p>
        </div>
        {/* 工具栏按钮区域 */}
        <div className="flex-shrink-0 flex items-center gap-3">
          {/* 批量导入按钮 */}
          {importConfig?.enabled && (
            <Button
              onClick={importConfig.onImport}
              variant="outline"
              size="lg"
              className="group relative h-11 px-6 text-base font-medium border-2 border-blue-200 hover:border-blue-400 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Upload className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
              <span>批量导入</span>
            </Button>
          )}
          
          {/* 自定义工具栏按钮 */}
          {customToolbarButtons}
          
          {/* 只有配置了创建权限才显示新建按钮 */}
          {config.permissions.create && config.permissions.create.length > 0 && (
            <Button 
              onClick={handleCreate}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200 h-11 px-6 text-base font-medium"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              新建{config.displayName}
            </Button>
          )}
        </div>
      </div>

      {/* 专业搜索模块 */}
      <SearchModule
        searchPlaceholder={searchPlaceholder}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        total={total}
        filterFields={enhancedConfig.list.filterFields}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        advancedSearchFields={enhancedConfig.list.advancedSearchFields}
        advancedSearchOpen={advancedSearchOpen}
        onAdvancedSearchOpenChange={setAdvancedSearchOpen}
        advancedSearchValues={advancedSearchValues}
        advancedSearchLogic={advancedSearchLogic}
        onAdvancedSearchChange={handleAdvancedSearchChange}
        onAdvancedSearchLogicChange={setAdvancedSearchLogic}
        onAdvancedSearch={handleAdvancedSearch}
        onResetAdvancedSearch={handleResetAdvancedSearch}
        fieldFuzzyLoadOptions={fieldFuzzyLoadOptions}
        extraFilterContent={customFilterContent?.(applyFilterValues)}
      />
      
      {/* 统计信息和批量操作工具栏 */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>共 <span className="font-semibold text-foreground">{total}</span> 条记录</span>
          {hasAnyDraftsToSave && (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isSavingAnyDrafts}
              className="h-8 min-w-[120px] bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => void handleUnifiedSaveDrafts()}
            >
              {isSavingAnyDrafts ? "保存中…" : `${pageDraftSave?.label ?? "保存修改"} (${totalDraftCount})`}
            </Button>
          )}
          {batchOpsEnabled && selectedRows.length > 0 && (
            <span className="ml-4 text-blue-600 dark:text-blue-400 font-medium">
              已选择 <span className="font-bold">{selectedRows.length}</span> 条
            </span>
          )}
        </div>
        {/* 批量操作工具栏 */}
        {batchOpsEnabled && selectedRows.length > 0 && (
          <div className="flex items-center gap-2">
            {batchEditEnabled && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setBatchEditDialogOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 min-w-[100px]"
              >
                <Edit className="mr-2 h-4 w-4" />
                批量编辑
              </Button>
            )}
            {batchDeleteEnabled && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBatchDeleteDialogOpen(true)}
                className="min-w-[100px]"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                批量删除
              </Button>
            )}
            {customBatchActions}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedRows([])}
              className="h-9 min-w-[100px]"
            >
              取消选择
            </Button>
          </div>
        )}
      </div>

      {/* 数据表格：Excel 式密度，浅边框少留白 */}
      <Card className="border border-border shadow-sm bg-card overflow-visible !py-0 !gap-0">
        <CardContent className="!p-0">
          <DataTable
        columns={columns}
        data={data}
        loading={loading}
        inlineEditUnboundedColumnIds={
          inlineEditEnabled ? inlineEditUnboundedColumnIds : undefined
        }
        inlineEditColumnWidthHints={
          inlineEditEnabled ? inlineEditColumnWidthHints : undefined
        }
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(newPage) => {
          void (async () => {
            if (paginationChangeGuard?.shouldIntercept()) {
              const ok = await paginationChangeGuard.confirm({
                nextPage: newPage,
                nextPageSize: pageSize,
              })
              if (!ok) return
            }
            allowUrlSyncRef.current = true
            setPage(newPage)
          })()
        }}
        onPageSizeChange={(newPageSize) => {
          void (async () => {
            if (paginationChangeGuard?.shouldIntercept()) {
              const ok = await paginationChangeGuard.confirm({
                nextPage: 1,
                nextPageSize: newPageSize,
              })
              if (!ok) return
            }
            allowUrlSyncRef.current = true
            setPageSize(newPageSize)
            setPage(1)
          })()
        }}
        onSortingChange={handleSortingChange}
        serverSidePagination={true}
        initialSorting={sorting}
        showColumnToggle={true}
        columnLabels={columnLabels}
        sortableColumns={sortableColumns}
        enableRowSelection={batchOpsEnabled}
        onRowSelectionChange={setSelectedRows}
        selectedRows={selectedRows}
        getIdValue={getIdValue}
        isRowEditing={inlineEditEnabled ? isRowEditing : undefined}
        onCancelEdit={inlineEditEnabled && draftRowIds.length > 0 ? handleCancelEdit : undefined}
        cancelEditOnSelectionChange={inlineEditEnabled ? false : true}
        expandableRows={expandableRows}
        enableViewManager={true}
        viewManagerTableName={config.name}
        getRowClassName={
          config.name === 'pickup_management'
            ? (row: any) => {
                // 如果提柜时间字段有值，返回绿色背景（符合系统风格）
                if (row.pickup_date != null && row.pickup_date !== '') {
                  return "bg-gradient-to-r from-green-100 via-emerald-50/80 to-green-100 dark:from-green-900/40 dark:via-emerald-900/30 dark:to-green-900/40 hover:from-green-200 hover:via-emerald-100/80 hover:to-green-200 dark:hover:from-green-800/50 dark:hover:via-emerald-800/40 dark:hover:to-green-800/50"
                }
                return undefined
              }
            : config.name === 'inbound_receipt'
            ? (row: any) => {
                // 状态为「查验」时整行红色
                if (row.status === 'inspection') {
                  return "bg-gradient-to-r from-red-100 via-red-50/80 to-red-100 dark:from-red-900/40 dark:via-red-900/30 dark:to-red-900/40 hover:from-red-200 hover:via-red-100/80 hover:to-red-200 dark:hover:from-red-800/50 dark:hover:via-red-800/40 dark:hover:to-red-800/50"
                }
                // 拆柜人员有值视为已录入，与提柜管理一致的浅绿色
                if (row.unloaded_by != null && row.unloaded_by !== '' || row.unloaded_by_id != null) {
                  return "bg-gradient-to-r from-green-100 via-emerald-50/80 to-green-100 dark:from-green-900/40 dark:via-emerald-900/30 dark:to-green-900/40 hover:from-green-200 hover:via-emerald-100/80 hover:to-green-200 dark:hover:from-green-800/50 dark:hover:via-emerald-800/40 dark:hover:to-green-800/50"
                }
                return undefined
              }
            : (config.name === 'outbound_shipments' || config.name === 'delivery_appointments')
            ? (row: any) => {
                // 出库管理 / 预约管理：按 拒收 > 校验装车单 > 已做单 优先级整行变色
                if (row.rejected === true) {
                  return "bg-gradient-to-r from-red-100 via-red-50/80 to-red-100 dark:from-red-900/40 dark:via-red-900/30 dark:to-red-900/40 hover:from-red-200 hover:via-red-100/80 hover:to-red-200 dark:hover:from-red-800/50 dark:hover:via-red-800/40 dark:hover:to-red-800/50"
                }
                if (row.verify_loading_sheet === true) {
                  return "bg-gradient-to-r from-amber-100 via-yellow-50/80 to-amber-100 dark:from-amber-900/40 dark:via-yellow-900/30 dark:to-amber-900/40 hover:from-amber-200 hover:via-yellow-100/80 hover:to-amber-200 dark:hover:from-amber-800/50 dark:hover:via-yellow-800/40 dark:hover:to-amber-800/50"
                }
                if (row.has_created_sheet === true) {
                  return "bg-gradient-to-r from-green-100 via-emerald-50/80 to-green-100 dark:from-green-900/40 dark:via-emerald-900/30 dark:to-green-900/40 hover:from-green-200 hover:via-emerald-100/80 hover:to-green-200 dark:hover:from-green-800/50 dark:hover:via-emerald-800/40 dark:hover:to-green-800/50"
                }
                return undefined
              }
            : undefined
        }
      />
        </CardContent>
      </Card>

      {/* 创建/编辑对话框 */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
          <DialogHeader className="space-y-3 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {editingItem ? `编辑${config.displayName}` : `新建${config.displayName}`}
            </DialogTitle>
            <DialogDescription className="text-base">
              {editingItem
                ? `修改${config.displayName}信息`
                : `填写${config.displayName}基本信息，创建新${config.displayName}`}
            </DialogDescription>
          </DialogHeader>
          {FormComponent ? (
            <FormComponent
              data={editingItem}
              config={config}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setOpenDialog(false)
                setEditingItem(null)
              }}
            />
          ) : (
            <EntityForm
              data={editingItem}
              config={config}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setOpenDialog(false)
                setEditingItem(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-0 shadow-2xl">
          <DialogHeader className="space-y-3 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold text-destructive">确认删除</DialogTitle>
            <DialogDescription className="text-base">
              确定要删除{config.displayName} <span className="font-semibold text-foreground">"{itemToDelete ? (() => {
                // 优先使用第一个显示列的值
                const firstColumn = config.list.columns?.[0]
                if (firstColumn && (itemToDelete as any)[firstColumn]) {
                  return (itemToDelete as any)[firstColumn]
                }
                // 回退到 name、code 或 id
                return (itemToDelete as any).name || (itemToDelete as any).code || (itemToDelete as any)[config.idField || 'id']
              })() : ''}"</span> 吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setItemToDelete(null)
              }}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量删除确认对话框 */}
      <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <DialogContent className="border-0 shadow-2xl">
          <DialogHeader className="space-y-3 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold text-destructive">确认批量删除</DialogTitle>
            <DialogDescription className="text-base">
              确定要删除选中的 <span className="font-semibold text-foreground">{selectedRows.length}</span> 条{config.displayName}记录吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleBatchDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量编辑对话框 */}
      <Dialog open={batchEditDialogOpen} onOpenChange={setBatchEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
          <DialogHeader className="space-y-3 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              批量编辑
            </DialogTitle>
            <DialogDescription className="text-base">
              您正在编辑 <span className="font-semibold text-foreground">{selectedRows.length}</span> 条{config.displayName}记录。只填写需要修改的字段，留空的字段将保持不变。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {batchEditableFields.map((fieldKey) => {
              // 处理字段名映射：origin_location_id -> origin_location, location_id -> destination_location
              // 以及 parent_id -> parent, manager_id -> manager
              let actualFieldKey = fieldKey
              let fieldConfig = config.fields[fieldKey]
              
              // 强制映射 location_id 字段（无论 fieldConfig 是否存在）
              if (fieldKey === 'location_id') {
                fieldConfig = config.fields['destination_location']
                actualFieldKey = 'destination_location'
              } else if (fieldKey === 'origin_location_id') {
                fieldConfig = config.fields['origin_location']
                actualFieldKey = 'origin_location'
              } else if (!fieldConfig && fieldKey.endsWith('_location_id')) {
                // 其他 location_id 字段的通用映射
                const baseKey = fieldKey.replace('_location_id', '_location')
                fieldConfig = config.fields[baseKey]
                actualFieldKey = baseKey
              } else if (fieldKey === 'parent_id' && !fieldConfig) {
                // parent_id 映射到 parent 字段配置
                fieldConfig = config.fields['parent']
                actualFieldKey = 'parent'
              } else if (fieldKey === 'manager_id' && !fieldConfig) {
                // manager_id 映射到 manager 字段配置
                fieldConfig = config.fields['manager']
                actualFieldKey = 'manager'
              } else if (fieldKey === 'department_id' && !fieldConfig) {
                // department_id 映射到 department 字段配置
                fieldConfig = config.fields['department']
                actualFieldKey = 'department'
              }
              
              if (!fieldConfig) {
                // 调试：如果找不到字段配置，打印警告
                if (process.env.NODE_ENV === 'development') {
                  console.warn(`[EntityTable] 批量编辑：找不到字段配置 fieldKey=${fieldKey}, actualFieldKey=${actualFieldKey}, availableFields=${Object.keys(config.fields).join(', ')}`)
                }
                return null
              }

              // 使用映射后的字段名获取值（如果字段名被映射了）
              // 注意：对于 location_id，我们需要从 batchEditValues['location_id'] 获取值
              const fieldValue = batchEditValues[fieldKey]

              // 根据字段类型渲染不同的输入控件
              switch (fieldConfig.type) {
                case 'text':
                case 'email':
                case 'phone':
                  return (
                    <div key={fieldKey} className="space-y-2">
                      <label className="text-sm font-medium">
                        {fieldConfig.label}
                      </label>
                      <input
                        type={fieldConfig.type === 'email' ? 'email' : fieldConfig.type === 'phone' ? 'tel' : 'text'}
                        value={fieldValue || ''}
                        onChange={(e) => handleBatchEditValueChange(fieldKey, e.target.value)}
                        placeholder={`输入新的${fieldConfig.label}（留空则不修改）`}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  )

                case 'number':
                case 'currency':
                  return (
                    <div key={fieldKey} className="space-y-2">
                      <label className="text-sm font-medium">
                        {fieldConfig.label}
                      </label>
                      <input
                        type="number"
                        step={fieldConfig.type === 'currency' ? '0.01' : '1'}
                        value={fieldValue || ''}
                        onChange={(e) => handleBatchEditValueChange(fieldKey, e.target.value ? Number(e.target.value) : '')}
                        placeholder={`输入新的${fieldConfig.label}（留空则不修改）`}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  )

                case 'date':
                  return (
                    <div key={fieldKey} className="space-y-2">
                      <label className="text-sm font-medium">
                        {fieldConfig.label}
                      </label>
                      <input
                        type="date"
                        value={fieldValue || ''}
                        onChange={(e) => handleBatchEditValueChange(fieldKey, e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  )

                case 'relation': {
                  // 如果是 location 类型字段（relation.model === 'locations'），使用 LocationSelect（分步选择）
                  if (fieldConfig.relation?.model === 'locations') {
                    return (
                      <div key={fieldKey} className="space-y-2">
                        <label className="text-sm font-medium">
                          {fieldConfig.label}
                        </label>
                        <LocationSelect
                          value={fieldValue || null}
                          onChange={(val) => handleBatchEditValueChange(fieldKey, val)}
                          placeholder="（留空则不修改）"
                          locationType={fieldConfig.locationType} // 支持直接指定位置类型
                        />
                      </div>
                    )
                  }
                  
                  // 其他关系字段：优先使用模糊搜索下拉框
                  // 注意：fieldFuzzyLoadOptions 的 key 可能是 parent_id/manager_id/department_id/carrier_id，但 fieldKey 可能是映射后的 parent/manager/department/carrier
                  const loadFuzzyOptionsKey = actualFieldKey === 'parent' ? 'parent_id' 
                    : actualFieldKey === 'manager' ? 'manager_id'
                    : actualFieldKey === 'department' ? 'department_id'
                    : actualFieldKey === 'carrier' ? 'carrier' // carrier 字段在 fieldFuzzyLoadOptions 中使用 'carrier' 作为 key
                    : fieldKey === 'carrier' ? 'carrier' // 也支持直接使用 'carrier'
                    : fieldKey
                  const loadFuzzyOptions = fieldFuzzyLoadOptions?.[loadFuzzyOptionsKey] || fieldFuzzyLoadOptions?.[fieldKey] || fieldFuzzyLoadOptions?.['carrier_id']
                  if (loadFuzzyOptions) {
                    return (
                      <div key={fieldKey} className="space-y-2">
                        <label className="text-sm font-medium">
                          {fieldConfig.label}
                        </label>
                        <FuzzySearchSelect
                          value={fieldValue || null}
                          onChange={(val) => handleBatchEditValueChange(fieldKey, val)}
                          placeholder="（留空则不修改）"
                          loadOptions={loadFuzzyOptions}
                        />
                      </div>
                    )
                  }
                  // 如果没有模糊搜索，使用 RelationFieldBatchEdit 组件
                  // 注意：fieldLoadOptions 的 key 可能是 parent_id/manager_id/department_id/carrier_id，但 fieldKey 可能是映射后的 parent/manager/department/carrier
                  const loadOptionsKey = actualFieldKey === 'parent' ? 'parent_id' 
                    : actualFieldKey === 'manager' ? 'manager_id'
                    : actualFieldKey === 'department' ? 'department_id'
                    : actualFieldKey === 'carrier' ? 'carrier' // carrier 字段在 fieldFuzzyLoadOptions 中使用 'carrier' 作为 key
                    : fieldKey === 'carrier' ? 'carrier' // 也支持直接使用 'carrier'
                    : fieldKey
                  return (
                    <RelationFieldBatchEdit
                      key={fieldKey}
                      fieldKey={fieldKey}
                      fieldConfig={fieldConfig}
                      fieldValue={fieldValue}
                      onValueChange={handleBatchEditValueChange}
                      loadOptions={fieldLoadOptions?.[loadOptionsKey] || fieldLoadOptions?.[fieldKey] || fieldLoadOptions?.['carrier_id']}
                      loadFuzzyOptions={fieldFuzzyLoadOptions?.[loadOptionsKey] || fieldFuzzyLoadOptions?.[fieldKey] || fieldFuzzyLoadOptions?.['carrier_id']}
                    />
                  )
                }

                case 'select':
                  return (
                    <div key={fieldKey} className="space-y-2">
                      <label className="text-sm font-medium">
                        {fieldConfig.label}
                      </label>
                      <select
                        value={fieldValue || ''}
                        onChange={(e) => handleBatchEditValueChange(fieldKey, e.target.value || '')}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">不修改</option>
                        {fieldConfig.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )

                case 'textarea':
                  return (
                    <div key={fieldKey} className="space-y-2">
                      <label className="text-sm font-medium">
                        {fieldConfig.label}
                      </label>
                      <textarea
                        value={fieldValue || ''}
                        onChange={(e) => handleBatchEditValueChange(fieldKey, e.target.value)}
                        placeholder={`输入新的${fieldConfig.label}（留空则不修改）`}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                        rows={3}
                      />
                    </div>
                  )

                case 'boolean':
                  return (
                    <div key={fieldKey} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={fieldValue === true || fieldValue === 'true'}
                          onChange={(e) => handleBatchEditValueChange(fieldKey, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label className="text-sm font-medium cursor-pointer">
                          {fieldConfig.label}
                        </label>
                      </div>
                    </div>
                  )

                case 'datetime': {
                  // 对于 pickup_date 字段，使用日期+小时选择器（分钟固定为00）
                  if (fieldKey === 'pickup_date') {
                    // 解析日期和小时
                    let datePart = ''
                    let hourPart = '00'
                    if (fieldValue) {
                      const datetimeStr = typeof fieldValue === 'string' 
                        ? fieldValue.slice(0, 16) 
                        : fieldValue instanceof Date
                        ? fieldValue.toISOString().slice(0, 16)
                        : String(fieldValue)
                      const parts = datetimeStr.split('T')
                      datePart = parts[0] || ''
                      if (parts[1]) {
                        hourPart = parts[1].split(':')[0] || '00'
                      }
                    }
                    
                    // 生成0-23小时选项
                    const hourOptions = Array.from({ length: 24 }, (_, i) => {
                      const hour = String(i).padStart(2, '0')
                      return { label: `${hour}:00`, value: hour }
                    })
                    
                    return (
                      <div key={fieldKey} className="space-y-2">
                        <label className="text-sm font-medium">
                          {fieldConfig.label}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={datePart}
                            onChange={(e) => {
                              const newDate = e.target.value
                              const newValue = newDate ? `${newDate}T${hourPart}:00` : null
                              handleBatchEditValueChange(fieldKey, newValue)
                            }}
                            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <Select
                            value={hourPart}
                            onValueChange={(newHour: string) => {
                              const newValue = datePart ? `${datePart}T${newHour}:00` : null
                              handleBatchEditValueChange(fieldKey, newValue)
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="选择小时" />
                            </SelectTrigger>
                            <SelectContent>
                              {hourOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )
                  }
                  
                  // 其他日期时间字段使用标准的 datetime-local 输入
                  return (
                    <div key={fieldKey} className="space-y-2">
                      <label className="text-sm font-medium">
                        {fieldConfig.label}
                      </label>
                      <input
                        type="datetime-local"
                        value={fieldValue || ''}
                        onChange={(e) => handleBatchEditValueChange(fieldKey, e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  )
                }

                case 'location':
                  // 位置选择字段：使用 LocationSelect 组件（支持 locationType 过滤）
                  return (
                    <div key={fieldKey} className="space-y-2">
                      <label className="text-sm font-medium">
                        {fieldConfig.label}
                      </label>
                      <LocationSelect
                        value={fieldValue || null}
                        onChange={(val) => handleBatchEditValueChange(fieldKey, val)}
                        placeholder={`选择新的${fieldConfig.label}（留空则不修改）`}
                        locationType={fieldConfig.locationType} // 支持直接指定位置类型
                      />
                    </div>
                  )

                case 'relation': {
                  // 如果是 location 类型字段（relation.model === 'locations'），使用 LocationSelect（分步选择）
                  if (fieldConfig.relation?.model === 'locations') {
                    return (
                      <div key={fieldKey} className="space-y-2">
                        <label className="text-sm font-medium">
                          {fieldConfig.label}
                        </label>
                        <LocationSelect
                          value={fieldValue || null}
                          onChange={(val) => handleBatchEditValueChange(fieldKey, val)}
                          placeholder="（留空则不修改）"
                        />
                      </div>
                    )
                  }
                  
                  // 其他关系字段：优先使用模糊搜索下拉框
                  const loadFuzzyOptions = fieldFuzzyLoadOptions?.[fieldKey]
                  if (loadFuzzyOptions) {
                    return (
                      <div key={fieldKey} className="space-y-2">
                        <label className="text-sm font-medium">
                          {fieldConfig.label}
                        </label>
                        <FuzzySearchSelect
                          value={fieldValue || null}
                          onChange={(val) => handleBatchEditValueChange(fieldKey, val)}
                          placeholder="（留空则不修改）"
                          loadOptions={loadFuzzyOptions}
                        />
                      </div>
                    )
                  }
                  // 如果没有模糊搜索，使用 RelationFieldBatchEdit 组件
                  return (
                    <RelationFieldBatchEdit
                      key={fieldKey}
                      fieldKey={fieldKey}
                      fieldConfig={fieldConfig}
                      fieldValue={fieldValue}
                      onValueChange={handleBatchEditValueChange}
                      loadOptions={fieldLoadOptions?.[fieldKey]}
                      loadFuzzyOptions={fieldFuzzyLoadOptions?.[fieldKey]}
                    />
                  )
                }

                default:
                  return null
              }
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBatchEditDialogOpen(false)
                setBatchEditValues({})
              }}
            >
              取消
            </Button>
            <Button onClick={handleBatchEdit}>
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 关系字段选择组件（单独组件以正确使用 hooks）
function RelationFieldSelect({
  fieldKey,
  fieldConfig,
  fieldValue,
  setBatchEditValues,
  batchEditValues,
  loadOptions,
}: {
  fieldKey: string
  fieldConfig: FieldConfig
  fieldValue: any
  setBatchEditValues: (values: Record<string, any>) => void
  batchEditValues: Record<string, any>
  loadOptions?: () => Promise<Array<{ label: string; value: string }>>
}) {
  const [relationOptions, setRelationOptions] = React.useState<Array<{ label: string; value: string }>>([])
  const [loadingRelationOptions, setLoadingRelationOptions] = React.useState(false)
  
  React.useEffect(() => {
    if (loadOptions) {
      setLoadingRelationOptions(true)
      loadOptions()
        .then((options) => {
          setRelationOptions(options)
        })
        .catch((error) => {
          console.error(`加载${fieldConfig.label}选项失败:`, error)
        })
        .finally(() => {
          setLoadingRelationOptions(false)
        })
    }
  }, [loadOptions, fieldConfig.label])
  
  // 使用函数式更新，避免闭包问题
  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    // 空字符串转换为 null，这样在提交时会被过滤掉（表示不修改）
    setBatchEditValues((prev: Record<string, any>) => ({ ...prev, [fieldKey]: value === '' ? null : value }))
  }, [fieldKey, setBatchEditValues])
  
  if (!loadOptions) {
    // 如果没有 loadOptions，返回 null
    return null
  }
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {fieldConfig.label}
      </label>
      <select
        value={fieldValue || ''}
        onChange={handleChange}
        disabled={loadingRelationOptions}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">（留空则不修改）</option>
        {relationOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

