/**
 * 行内编辑单元格组件
 * 用于在行内编辑模式下渲染可编辑字段
 */

"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldConfig } from "@/lib/crud/types"
import { formatDateDisplay, formatDateTimeDisplay } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"
import {
  getCarrierCodeCellClass,
  CARRIER_CODE_CELL_SURFACE_LAYOUT,
  formatCarrierCodeDisplay,
} from "@/lib/utils/carrier-code-display"
import { LocationSelect } from "@/components/ui/location-select"
import { FuzzySearchSelect, FuzzySearchOption } from "@/components/ui/fuzzy-search-select"
import { ChevronDown, Check, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

/** 根容器：在 table-fixed 列宽下不撑开 td，内容过宽时截断 */
const CELL_ROOT = "inline-edit-cell min-w-0 w-full max-w-full overflow-hidden"

/** 弹出编辑触发器：外观与只读展示一致，固定 h-8 不撑开行高 */
const CELL_TRIGGER =
  "flex h-8 min-h-8 w-full min-w-0 max-w-full items-center rounded-sm px-1 text-sm outline-none hover:bg-muted/40 focus-visible:ring-1 focus-visible:ring-ring"

/** 弹出层内紧凑控件 */
const POPOVER_INPUT = "h-8 text-sm bg-background"

interface InlinePopoverEditProps {
  displayText: string
  emptyPlaceholder?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

function InlinePopoverEdit({
  displayText,
  emptyPlaceholder = '-',
  open,
  onOpenChange,
  children,
  className,
  contentClassName,
}: InlinePopoverEditProps) {
  const hasValue = displayText && displayText !== '-'
  return (
    <div onClick={(e) => e.stopPropagation()} className={CELL_ROOT}>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(CELL_TRIGGER, className)}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className={cn(
                'block min-w-0 w-full truncate text-center',
                !hasValue && 'text-muted-foreground'
              )}
            >
              {hasValue ? displayText : emptyPlaceholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className={cn('w-auto p-2', contentClassName)}
          align="start"
          side="bottom"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface InlineEditCellProps {
  fieldKey: string
  fieldConfig: FieldConfig
  value: any
  onChange: (value: any) => void
  /** 失焦或选完下拉后触发，由 EntityTable 做乐观保存 */
  onBlurSave?: () => void
  className?: string
  loadOptions?: () => Promise<Array<{ label: string; value: string }>>
  loadFuzzyOptions?: (search: string) => Promise<FuzzySearchOption[]>
  /** 进入编辑后：下拉/弹层类控件自动展开（Excel 式） */
  autoOpenDropdown?: boolean
}

/** 静态/异步选项的 Select 行内编辑，支持进入时自动展开 */
function InlineSelectWithAutoOpen({
  autoOpenDropdown,
  loadingOptions,
  internalValue,
  fieldConfig,
  className,
  selectOptions,
  onInternalChange,
  onCommit,
  onBlurSave,
}: {
  autoOpenDropdown: boolean
  loadingOptions: boolean
  internalValue: any
  fieldConfig: FieldConfig
  className?: string
  selectOptions: Array<{ label: string; value: string }>
  onInternalChange: (v: any) => void
  onCommit: (v: any) => void
  onBlurSave?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const didAutoOpenRef = React.useRef(false)
  React.useEffect(() => {
    if (!autoOpenDropdown || loadingOptions || didAutoOpenRef.current) return
    didAutoOpenRef.current = true
    setOpen(true)
  }, [autoOpenDropdown, loadingOptions])
  return (
    <div onClick={(e) => e.stopPropagation()} className={CELL_ROOT}>
      <Select
        open={open}
        onOpenChange={setOpen}
        value={internalValue || ""}
        onValueChange={(val) => {
          if (val === "__clear__") {
            onInternalChange(null)
            onCommit(null)
            onBlurSave?.()
          } else {
            onInternalChange(val || null)
            onCommit(val || null)
            onBlurSave?.()
          }
        }}
        disabled={loadingOptions}
      >
        <SelectTrigger className={cn("h-8 text-sm min-w-0 w-full", className)}>
          <SelectValue placeholder={loadingOptions ? "加载中..." : `请选择${fieldConfig.label}`} />
        </SelectTrigger>
        <SelectContent position="popper" side="bottom" align="start" sideOffset={4}>
          {internalValue && (
            <SelectItem value="__clear__" key="__clear__">
              <span className="text-muted-foreground italic">（清空）</span>
            </SelectItem>
          )}
          {selectOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** relation + loadOptions 的 Select（含暂无选项态），支持进入时自动展开 */
function InlineRelationSelectWithAutoOpen({
  autoOpenDropdown,
  loadingOptions,
  internalValue,
  fieldConfig,
  className,
  selectOptions,
  onInternalChange,
  onCommit,
  onBlurSave,
}: {
  autoOpenDropdown: boolean
  loadingOptions: boolean
  internalValue: any
  fieldConfig: FieldConfig
  className?: string
  selectOptions: Array<{ label: string; value: string }>
  onInternalChange: (v: any) => void
  onCommit: (v: any) => void
  onBlurSave?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const didAutoOpenRef = React.useRef(false)
  React.useEffect(() => {
    if (!autoOpenDropdown || loadingOptions || didAutoOpenRef.current) return
    didAutoOpenRef.current = true
    setOpen(true)
  }, [autoOpenDropdown, loadingOptions])
  return (
    <div onClick={(e) => e.stopPropagation()} className={CELL_ROOT}>
      <Select
        open={open}
        onOpenChange={setOpen}
        value={internalValue || ""}
        onValueChange={(val) => {
          if (val === "__clear__") {
            onInternalChange(null)
            onCommit(null)
            onBlurSave?.()
          } else {
            onInternalChange(val || null)
            onCommit(val || null)
            onBlurSave?.()
          }
        }}
        disabled={loadingOptions}
      >
        <SelectTrigger className={cn("h-8 text-sm min-w-0 w-full", className)}>
          <SelectValue placeholder={loadingOptions ? "加载中..." : `请选择${fieldConfig.label}`} />
        </SelectTrigger>
        <SelectContent>
          {selectOptions.length === 0 && !loadingOptions ? (
            <SelectItem value="__disabled__" disabled>
              暂无选项
            </SelectItem>
          ) : (
            <>
              {internalValue && (
                <SelectItem value="__clear__" key="__clear__">
                  <span className="text-muted-foreground italic">（清空）</span>
                </SelectItem>
              )}
              {selectOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

/** 进入行内编辑时自动聚焦并打开原生日期选择器 */
function DatePopoverInlineEdit({
  internalValue,
  autoOpen,
  className,
  onInternalChange,
  onChange,
  onBlur,
}: {
  internalValue: unknown
  autoOpen: boolean
  className?: string
  onInternalChange: (value: string | null) => void
  onChange: (value: string | null) => void
  onBlur: () => void
}) {
  const dateValue = internalValue
    ? internalValue instanceof Date
      ? internalValue.toISOString().split('T')[0]
      : typeof internalValue === 'string'
        ? internalValue.split('T')[0]
        : String(internalValue)
    : ''
  const dateDisplay = formatDateDisplay(
    internalValue as string | Date | null | undefined
  )
  const [open, setOpen] = React.useState(false)
  const dateInputRef = React.useRef<HTMLInputElement>(null)
  const didAutoOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (!autoOpen || didAutoOpenRef.current) return
    didAutoOpenRef.current = true
    setOpen(true)
  }, [autoOpen])

  React.useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      const el = dateInputRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      if (typeof el.showPicker === 'function') {
        try {
          el.showPicker()
        } catch {
          // ignore
        }
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [open])

  return (
    <InlinePopoverEdit
      displayText={dateDisplay}
      emptyPlaceholder="选择日期"
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) onBlur()
      }}
      className={className}
    >
      <div className="flex items-center gap-1">
        <Input
          ref={dateInputRef}
          type="date"
          value={dateValue}
          onChange={(e) => onInternalChange(e.target.value || null)}
          className={cn(POPOVER_INPUT, 'w-[9.5rem] shrink-0', className)}
        />
        {internalValue ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground/60 hover:text-muted-foreground"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onInternalChange(null)
              onChange(null)
            }}
            title="清空"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </InlinePopoverEdit>
  )
}

/** 通用 datetime-local：Popover 内编辑 */
function DatetimePopoverInlineEdit({
  internalValue,
  autoOpen,
  className,
  onInternalChange,
  onBlur,
}: {
  internalValue: unknown
  autoOpen: boolean
  className?: string
  onInternalChange: (value: string | null) => void
  onBlur: () => void
}) {
  let datetimeValue = ''
  if (internalValue) {
    if (internalValue instanceof Date) {
      const year = internalValue.getUTCFullYear()
      const month = String(internalValue.getUTCMonth() + 1).padStart(2, '0')
      const day = String(internalValue.getUTCDate()).padStart(2, '0')
      const hours = String(internalValue.getUTCHours()).padStart(2, '0')
      const minutes = String(internalValue.getUTCMinutes()).padStart(2, '0')
      datetimeValue = `${year}-${month}-${day}T${hours}:${minutes}`
    } else if (typeof internalValue === 'string') {
      datetimeValue = internalValue.slice(0, 16)
    } else {
      datetimeValue = String(internalValue)
    }
  }
  const datetimeDisplay = formatDateTimeDisplay(
    internalValue as string | Date | null | undefined
  )
  const [open, setOpen] = React.useState(false)
  const datetimeInputRef = React.useRef<HTMLInputElement>(null)
  const didAutoOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (!autoOpen || didAutoOpenRef.current) return
    didAutoOpenRef.current = true
    setOpen(true)
  }, [autoOpen])

  React.useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      datetimeInputRef.current?.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(t)
  }, [open])

  return (
    <InlinePopoverEdit
      displayText={datetimeDisplay}
      emptyPlaceholder="选择日期时间"
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) onBlur()
      }}
      className={className}
    >
      <Input
        ref={datetimeInputRef}
        type="datetime-local"
        value={datetimeValue}
        onChange={(e) => onInternalChange(e.target.value || null)}
        className={cn(POPOVER_INPUT, 'w-[11.5rem] shrink-0', className)}
      />
    </InlinePopoverEdit>
  )
}

/** 备注：Popover 内 textarea */
function NotesPopoverInlineEdit({
  internalValue,
  autoOpen,
  className,
  fieldConfig,
  onInternalChange,
  onBlur,
}: {
  internalValue: unknown
  autoOpen: boolean
  className?: string
  fieldConfig: FieldConfig
  onInternalChange: (value: string) => void
  onBlur: () => void
}) {
  const notesDisplay =
    internalValue && String(internalValue).trim()
      ? String(internalValue).trim()
      : '-'
  const [open, setOpen] = React.useState(false)
  const didAutoOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (!autoOpen || didAutoOpenRef.current) return
    didAutoOpenRef.current = true
    setOpen(true)
  }, [autoOpen])

  return (
    <InlinePopoverEdit
      displayText={notesDisplay}
      emptyPlaceholder="输入备注"
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) onBlur()
      }}
      className={className}
      contentClassName="w-64"
    >
      <Textarea
        value={internalValue != null && internalValue !== '' ? String(internalValue) : ''}
        onChange={(e) => onInternalChange(e.target.value)}
        placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
        className="min-h-[72px] text-sm resize-none"
        rows={3}
        autoFocus
      />
    </InlinePopoverEdit>
  )
}

/** 提柜日期：小时下拉 */
function PickupDateHourSelect({
  hourPart,
  hourOptions,
  onHourChange,
  className,
}: {
  hourPart: string
  hourOptions: { label: string; value: string }[]
  onHourChange: (hour: string) => void
  className?: string
}) {
  return (
    <Select value={hourPart} onValueChange={onHourChange}>
      <SelectTrigger className={cn("w-20 h-8 text-sm bg-background", className)}>
        <SelectValue placeholder="小时" />
      </SelectTrigger>
      <SelectContent>
        {hourOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const PICKUP_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = String(i).padStart(2, '0')
  return { label: `${hour}:00`, value: hour }
})

function parsePickupDateParts(internalValue: unknown): { datePart: string; hourPart: string } {
  let datePart = ''
  let hourPart = '00'
  if (!internalValue) return { datePart, hourPart }

  let datetimeStr = ''
  if (internalValue instanceof Date) {
    const year = internalValue.getUTCFullYear()
    const month = String(internalValue.getUTCMonth() + 1).padStart(2, '0')
    const day = String(internalValue.getUTCDate()).padStart(2, '0')
    const hours = String(internalValue.getUTCHours()).padStart(2, '0')
    datetimeStr = `${year}-${month}-${day}T${hours}:00`
  } else if (typeof internalValue === 'string') {
    datetimeStr = internalValue.slice(0, 16)
  } else {
    datetimeStr = String(internalValue)
  }
  const parts = datetimeStr.split('T')
  datePart = parts[0] || ''
  if (parts[1]) {
    hourPart = parts[1].split(':')[0] || '00'
  }
  return { datePart, hourPart }
}

/** 提柜日期：Popover 内编辑，单元格仅展示格式化文本 */
function PickupDateInlineEdit({
  internalValue,
  className,
  autoOpenDate,
  onInternalChange,
  onChange,
  onBlur,
  onBlurSave,
}: {
  internalValue: unknown
  className?: string
  autoOpenDate: boolean
  onInternalChange: (value: string | null) => void
  onChange: (value: string | null) => void
  onBlur: () => void
  onBlurSave?: () => void
}) {
  const { datePart, hourPart } = parsePickupDateParts(internalValue)
  const [open, setOpen] = React.useState(false)
  const dateInputRef = React.useRef<HTMLInputElement>(null)
  const didAutoOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (!autoOpenDate || didAutoOpenRef.current) return
    didAutoOpenRef.current = true
    setOpen(true)
  }, [autoOpenDate])

  React.useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      const el = dateInputRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      if (typeof el.showPicker === 'function') {
        try {
          el.showPicker()
        } catch {
          // 部分浏览器可能拒绝 showPicker
        }
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [open])

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next)
      if (!next) {
        onBlur()
        onBlurSave?.()
      }
    },
    [onBlur, onBlurSave]
  )

  const displayText = formatDateTimeDisplay(
    internalValue as string | Date | null | undefined
  )

  return (
    <InlinePopoverEdit
      displayText={displayText}
      emptyPlaceholder="选择日期时间"
      open={open}
      onOpenChange={handleOpenChange}
      className={className}
    >
      <div className="flex items-center gap-2">
        <Input
          ref={dateInputRef}
          type="date"
          value={datePart}
          onChange={(e) => {
            const newDate = e.target.value
            const newValue = newDate ? `${newDate}T${hourPart}:00` : null
            onInternalChange(newValue)
            onChange(newValue)
          }}
          className={cn(POPOVER_INPUT, 'w-[9.5rem] shrink-0', className)}
        />
        <PickupDateHourSelect
          hourPart={hourPart}
          hourOptions={PICKUP_HOUR_OPTIONS}
          onHourChange={(newHour) => {
            const newValue = datePart ? `${datePart}T${newHour}:00` : null
            onInternalChange(newValue)
            onChange(newValue)
          }}
        />
        {internalValue ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground/60 hover:text-muted-foreground"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onInternalChange(null)
              onChange(null)
            }}
            title="清空"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </InlinePopoverEdit>
  )
}

/** 承运公司文本输入：进入编辑时主动聚焦（autoFocus 只在挂载瞬间生效，时机不可靠） */
function CarrierCodeInlineInput({
  internalValue,
  autoFocus,
  className,
  fieldConfig,
  onInternalChange,
  onBlur,
}: {
  internalValue: unknown
  autoFocus: boolean
  className?: string
  fieldConfig: FieldConfig
  onInternalChange: (value: string) => void
  onBlur: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const didFocusRef = React.useRef(false)

  React.useEffect(() => {
    if (!autoFocus || didFocusRef.current) return
    didFocusRef.current = true
    const t = window.setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      el.select()
    }, 0)
    return () => window.clearTimeout(t)
  }, [autoFocus])

  const displayForBg =
    formatCarrierCodeDisplay(
      internalValue != null && internalValue !== '' ? String(internalValue) : null
    ) ?? (internalValue ? String(internalValue).trim().toUpperCase() : null)

  return (
    <div onClick={(e) => e.stopPropagation()} className="relative h-full min-h-8 w-full">
      <Input
        ref={inputRef}
        type="text"
        value={(internalValue as string) || ''}
        onChange={(e) => onInternalChange(e.target.value.toUpperCase())}
        onBlur={onBlur}
        placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
        className={cn(
          CARRIER_CODE_CELL_SURFACE_LAYOUT,
          getCarrierCodeCellClass(displayForBg),
          'border-0 shadow-none rounded-none text-center focus-visible:ring-0 focus-visible:ring-offset-0',
          className
        )}
      />
    </div>
  )
}

export function InlineEditCell({
  fieldKey,
  fieldConfig,
  value,
  onChange,
  onBlurSave,
  className,
  loadOptions,
  loadFuzzyOptions,
  autoOpenDropdown = false,
}: InlineEditCellProps) {
  // 使用内部状态管理输入值，避免每次输入都触发外部状态更新
  // 对于 boolean 字段，需要特殊处理：false 是有效值，不应该被转换为 ''
  // 对于 number/currency 字段，0 是有效值（与入库管理详情页实际板数一致），不应被当作空
  const getInitialValue = () => {
    if (fieldConfig.type === 'boolean') {
      return value !== undefined && value !== null ? Boolean(value) : false
    }
    if (fieldConfig.type === 'number' || fieldConfig.type === 'currency') {
      return value !== undefined && value !== null ? value : ''
    }
    return value || ''
  }
  const [internalValue, setInternalValue] = React.useState(getInitialValue())
  const [selectOptions, setSelectOptions] = React.useState<Array<{ label: string; value: string }>>(
    fieldConfig.options || []
  )
  const [loadingOptions, setLoadingOptions] = React.useState(false)
  
  // 同步外部 value 到内部状态（只在外部 value 改变时更新，比如初始化或取消编辑）
  React.useEffect(() => {
    if (fieldConfig.type === 'boolean') {
      setInternalValue(value !== undefined && value !== null ? Boolean(value) : false)
    } else if (fieldConfig.type === 'number' || fieldConfig.type === 'currency') {
      setInternalValue(value !== undefined && value !== null ? value : '')
    } else {
      setInternalValue(value || '')
    }
  }, [value, fieldConfig.type])
  
  // 处理输入变化：只更新内部状态，不触发外部更新
  const handleInternalChange = React.useCallback((newValue: any) => {
    setInternalValue(newValue)
  }, [])
  
  // 失去焦点时同步草稿并触发保存
  const handleBlur = React.useCallback(() => {
    if (internalValue !== value) {
      onChange(internalValue)
    }
    onBlurSave?.()
  }, [internalValue, value, onChange, onBlurSave])

  // 异步加载选项（支持 select 和 relation 类型）
  // 对于 current_location 字段，始终加载选项（从 fieldConfig.options）
  React.useEffect(() => {
    if (fieldKey === 'current_location' && fieldConfig.options) {
      // current_location 使用静态选项，直接设置
      setSelectOptions(fieldConfig.options)
    } else if ((fieldConfig.type === 'select' || fieldConfig.type === 'relation') && loadOptions && selectOptions.length === 0 && !loadingOptions) {
      setLoadingOptions(true)
      loadOptions()
        .then((loadedOptions) => {
          setSelectOptions(loadedOptions)
        })
        .catch((error) => {
          console.error(`加载选项失败 (${fieldKey}):`, error)
        })
        .finally(() => {
          setLoadingOptions(false)
        })
    }
  }, [fieldConfig.type, loadOptions, fieldKey, selectOptions.length, loadingOptions, fieldConfig.options])

  // 根据字段类型渲染不同的输入控件
  switch (fieldConfig.type) {
    case 'text':
    case 'email':
    case 'phone':
      // 备注字段：Popover 内编辑，单元格不撑高
      if (fieldKey === 'notes') {
        return (
          <NotesPopoverInlineEdit
            internalValue={internalValue}
            autoOpen={autoOpenDropdown}
            className={className}
            fieldConfig={fieldConfig}
            onInternalChange={handleInternalChange}
            onBlur={handleBlur}
          />
        )
      }
      if (fieldKey === 'carrier_code') {
        return (
          <CarrierCodeInlineInput
            internalValue={internalValue}
            autoFocus={autoOpenDropdown}
            className={className}
            fieldConfig={fieldConfig}
            onInternalChange={handleInternalChange}
            onBlur={handleBlur}
          />
        )
      }
      return (
        <div onClick={(e) => e.stopPropagation()} className={CELL_ROOT}>
          <Input
            type={fieldConfig.type === 'email' ? 'email' : fieldConfig.type === 'phone' ? 'tel' : 'text'}
            value={internalValue || ''}
            onChange={(e) => handleInternalChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
            className={cn("h-8 text-sm min-w-0 w-full max-w-full px-1", className)}
          />
        </div>
      )

    case 'number':
    case 'currency':
      // 0 为有效值，展示与入库管理详情页一致；空输入用 ''
      const numDisplayValue = internalValue === '' || internalValue === undefined || internalValue === null ? '' : internalValue
      return (
        <div onClick={(e) => e.stopPropagation()} className={CELL_ROOT}>
          <Input
            type="number"
            step={fieldConfig.type === 'currency' ? '0.01' : '1'}
            value={numDisplayValue}
            onChange={(e) => handleInternalChange(e.target.value === '' ? '' : Number(e.target.value))}
            onBlur={handleBlur}
            placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
            className={cn("h-8 text-sm min-w-0 w-full max-w-full px-1", className)}
          />
        </div>
      )

    case 'date':
      return (
        <DatePopoverInlineEdit
          internalValue={internalValue}
          autoOpen={autoOpenDropdown}
          className={className}
          onInternalChange={handleInternalChange}
          onChange={onChange}
          onBlur={handleBlur}
        />
      )

    case 'datetime': {
      if (fieldKey === 'pickup_date') {
        return (
          <PickupDateInlineEdit
            internalValue={internalValue}
            className={className}
            autoOpenDate={autoOpenDropdown}
            onInternalChange={handleInternalChange}
            onChange={onChange}
            onBlur={() => {
              if (internalValue !== value) {
                onChange(internalValue)
              }
            }}
            onBlurSave={onBlurSave}
          />
        )
      }
      
      return (
        <DatetimePopoverInlineEdit
          internalValue={internalValue}
          autoOpen={autoOpenDropdown}
          className={className}
          onInternalChange={handleInternalChange}
          onBlur={handleBlur}
        />
      )
    }

    case 'select':
    case 'badge':
      // badge 类型在编辑时也使用下拉框（如果有 options）
      if (fieldConfig.type === 'badge' && !fieldConfig.options) {
        // 如果没有 options，回退到默认处理
        break
      }
      // 对于 current_location 字段，使用 combobox 组件，支持自定义输入和下拉选择
      if (fieldKey === 'current_location') {
        const [open, setOpen] = React.useState(autoOpenDropdown)
        const [searchValue, setSearchValue] = React.useState("")
        
        // 确保选项已加载
        React.useEffect(() => {
          if (fieldConfig.options && selectOptions.length === 0) {
            setSelectOptions(fieldConfig.options)
          }
        }, [fieldConfig.options, selectOptions.length])
        
        // 当输入框值改变时，同步到 searchValue
        React.useEffect(() => {
          setSearchValue(internalValue || "")
        }, [internalValue])
        
        // 过滤选项（支持搜索）
        const filteredOptions = React.useMemo(() => {
          if (!searchValue) {
            return selectOptions
          }
          const searchLower = searchValue.toLowerCase()
          return selectOptions.filter(option => 
            option.label.toLowerCase().includes(searchLower) ||
            option.value.toLowerCase().includes(searchLower)
          )
        }, [selectOptions, searchValue])
        
        return (
          <div onClick={(e) => e.stopPropagation()} className={CELL_ROOT}>
            <Popover
              open={open}
              onOpenChange={setOpen}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={open}
                  className={cn(
                    "flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                    className
                  )}
                >
                  <span className={cn("truncate", !internalValue && "text-muted-foreground")}>
                    {internalValue || "选择或输入位置"}
                  </span>
                  <ChevronDown className={cn(
                    "ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform",
                    open && "rotate-180"
                  )} />
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="p-0" 
                align="start"
                style={{ 
                  width: 'max-content',
                  minWidth: 'var(--radix-popover-trigger-width)',
                  maxWidth: '400px'
                }}
              >
                <div className="border-b px-3 py-2 min-w-[200px]">
                  <input
                    type="text"
                    placeholder="搜索或输入位置..." 
                    value={searchValue}
                    onChange={(e) => {
                      const value = e.target.value
                      setSearchValue(value)
                      handleInternalChange(value || null)
                      // 立即同步到外部，确保自定义输入的值能被保存
                      onChange(value || null)
                    }}
                    onBlur={() => {
                      // 光标离开（点到弹层外）即保存；点选项有 onMouseDown preventDefault，不会触发此 blur
                      onBlurSave?.()
                    }}
                    className="flex h-9 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    autoFocus
                  />
                </div>
                {filteredOptions.length > 0 && (
                  <div className="max-h-[200px] overflow-auto p-1 min-w-[200px]">
                    {filteredOptions.map((option) => (
                      <div
                        key={option.value}
                        className={cn(
                          "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors whitespace-nowrap",
                          "hover:bg-accent hover:text-accent-foreground",
                          internalValue === option.value && "bg-accent text-accent-foreground"
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const selectedValue = option.value
                          handleInternalChange(selectedValue)
                          setSearchValue(selectedValue)
                          onChange(selectedValue)
                          // 选中即保存（草稿已同步），再关闭弹层
                          onBlurSave?.()
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            internalValue === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate">{option.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        )
      }
      return (
        <InlineSelectWithAutoOpen
          autoOpenDropdown={autoOpenDropdown}
          loadingOptions={loadingOptions}
          internalValue={internalValue}
          fieldConfig={fieldConfig}
          className={className}
          selectOptions={selectOptions}
          onInternalChange={handleInternalChange}
          onCommit={onChange}
          onBlurSave={onBlurSave}
        />
      )

    case 'textarea':
      return (
        <NotesPopoverInlineEdit
          internalValue={internalValue}
          autoOpen={autoOpenDropdown}
          className={className}
          fieldConfig={fieldConfig}
          onInternalChange={handleInternalChange}
          onBlur={handleBlur}
        />
      )

    case 'boolean':
      // boolean 字段：确保 internalValue 是布尔类型
      const boolValue = typeof internalValue === 'boolean' 
        ? internalValue 
        : (internalValue === true || internalValue === 'true' || internalValue === 1 || internalValue === '1')
      return (
        <div onClick={(e) => e.stopPropagation()} className={CELL_ROOT}>
          <input
            type="checkbox"
            checked={boolValue}
            onChange={(e) => {
              const newValue = e.target.checked
              handleInternalChange(newValue)
              onChange(newValue)
              onBlurSave?.()
            }}
            className={cn("h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary", className)}
          />
        </div>
      )

    case 'location':
      // 位置选择字段（使用 LocationSelect 组件 - 框架级复用组件）
      // 注意：不传递className来改变核心样式，保持统一的白色样式
      // 如果字段配置中指定了 locationType，则只显示该类型的位置
      return (
        <div onClick={(e) => e.stopPropagation()} className={CELL_ROOT}>
          <LocationSelect
            value={internalValue || null}
            onChange={(val) => {
              handleInternalChange(val)
              onChange(val) // 立即同步到外部
            }}
            onBlur={handleBlur}
            placeholder={fieldConfig.placeholder || `请选择${fieldConfig.label}`}
            className={cn("h-8 min-w-0 max-w-full", className)}
            locationType={fieldConfig.locationType} // 支持直接指定位置类型
            autoOpenOnMount={autoOpenDropdown}
          />
        </div>
      )

    case 'relation':
      // 处理 locations 关联字段（使用 LocationSelect 组件 - 框架级复用组件）
      // 注意：不传递className来改变核心样式，保持统一的白色样式
      if (fieldConfig.relation?.model === 'locations') {
        return (
          <div onClick={(e) => e.stopPropagation()} className={CELL_ROOT}>
            <LocationSelect
              value={internalValue || null}
              onChange={(val) => {
                handleInternalChange(val)
                onChange(val) // 立即同步到外部
              }}
              onBlur={handleBlur}
              placeholder={fieldConfig.placeholder || `请选择${fieldConfig.label}`}
              className={cn("h-8 min-w-0 max-w-full", className)}
              locationType={fieldConfig.locationType} // 支持直接指定位置类型
              autoOpenOnMount={autoOpenDropdown}
            />
          </div>
        )
      }
      // 其他关联字段：优先使用模糊搜索下拉框（如果有 loadFuzzyOptions）
      if (loadFuzzyOptions) {
        return (
          <div onClick={(e) => e.stopPropagation()} className={CELL_ROOT}>
            <FuzzySearchSelect
              value={internalValue || null}
              onChange={(val) => {
                handleInternalChange(val)
                onChange(val) // 立即同步到外部
              }}
              onBlur={handleBlur}
              placeholder={fieldConfig.placeholder || `请选择${fieldConfig.label}`}
              className={cn("h-8 min-w-0 max-w-full", className)}
              loadOptions={loadFuzzyOptions}
              autoOpenOnMount={Boolean(autoOpenDropdown)}
            />
          </div>
        )
      }
      
      // 如果没有 loadFuzzyOptions，但有 loadOptions，使用普通下拉框
      if (loadOptions) {
        // 确保选项已加载
        React.useEffect(() => {
          if (selectOptions.length === 0 && !loadingOptions) {
            setLoadingOptions(true)
            loadOptions()
              .then((loadedOptions) => {
                setSelectOptions(loadedOptions)
              })
              .catch((error) => {
                console.error(`加载${fieldKey}选项失败:`, error)
              })
              .finally(() => {
                setLoadingOptions(false)
              })
          }
        }, [loadOptions, fieldKey, selectOptions.length, loadingOptions])
        
        return (
          <InlineRelationSelectWithAutoOpen
            autoOpenDropdown={autoOpenDropdown}
            loadingOptions={loadingOptions}
            internalValue={internalValue}
            fieldConfig={fieldConfig}
            className={className}
            selectOptions={selectOptions}
            onInternalChange={handleInternalChange}
            onCommit={onChange}
            onBlurSave={onBlurSave}
          />
        )
      }
      // 如果没有 loadOptions 和 loadFuzzyOptions，使用默认处理
      break

    default:
      // 默认显示为文本输入
      return (
        <div onClick={(e) => e.stopPropagation()} className={CELL_ROOT}>
          <Input
            type="text"
            value={internalValue?.toString() || ''}
            onChange={(e) => handleInternalChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
            className={cn("h-8 min-w-0 w-full max-w-full px-1 text-sm", className)}
          />
        </div>
      )
  }
}
