/**
 * 行内编辑单元格组件
 * 用于在行内编辑模式下渲染可编辑字段
 */

"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
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

interface InlineEditCellProps {
  fieldKey: string
  fieldConfig: FieldConfig
  value: any
  onChange: (value: any) => void
  className?: string
  loadOptions?: () => Promise<Array<{ label: string; value: string }>>
}

export function InlineEditCell({
  fieldKey,
  fieldConfig,
  value,
  onChange,
  className,
  loadOptions,
}: InlineEditCellProps) {
  const [selectOptions, setSelectOptions] = React.useState<Array<{ label: string; value: string }>>(
    fieldConfig.options || []
  )
  const [loadingOptions, setLoadingOptions] = React.useState(false)

  // 异步加载选项
  React.useEffect(() => {
    if (fieldConfig.type === 'select' && loadOptions && selectOptions.length === 0) {
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
  }, [fieldConfig.type, loadOptions, fieldKey, selectOptions.length])

  // 根据字段类型渲染不同的输入控件
  switch (fieldConfig.type) {
    case 'text':
    case 'email':
    case 'phone':
      return (
        <Input
          type={fieldConfig.type === 'email' ? 'email' : fieldConfig.type === 'phone' ? 'tel' : 'text'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
          className={cn("h-8 text-sm", className)}
        />
      )

    case 'number':
    case 'currency':
      return (
        <Input
          type="number"
          step={fieldConfig.type === 'currency' ? '0.01' : '1'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
          placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
          className={cn("h-8 text-sm", className)}
        />
      )

    case 'date':
      // 处理日期：显示和编辑都使用 YYYY-MM-DD 格式
      const dateValue = value 
        ? (value instanceof Date 
          ? value.toISOString().split("T")[0] 
          : typeof value === 'string' 
          ? value.split("T")[0] 
          : value)
        : ''
      return (
        <Input
          type="date"
          value={dateValue}
          onChange={(e) => onChange(e.target.value || null)}
          className={cn("h-8 text-sm", className)}
        />
      )

    case 'datetime': {
      // 处理日期时间：显示和编辑都使用 YYYY-MM-DDTHH:mm 格式
      // 避免使用 getTimezoneOffset() 以防止 hydration 错误
      let datetimeValue = ''
      if (value) {
        if (value instanceof Date) {
          // 使用 UTC 时间，避免时区问题
          const year = value.getUTCFullYear()
          const month = String(value.getUTCMonth() + 1).padStart(2, '0')
          const day = String(value.getUTCDate()).padStart(2, '0')
          const hours = String(value.getUTCHours()).padStart(2, '0')
          const minutes = String(value.getUTCMinutes()).padStart(2, '0')
          datetimeValue = `${year}-${month}-${day}T${hours}:${minutes}`
        } else if (typeof value === 'string') {
          datetimeValue = value.slice(0, 16)
        } else {
          datetimeValue = String(value)
        }
      }
      return (
        <Input
          type="datetime-local"
          value={datetimeValue}
          onChange={(e) => onChange(e.target.value || null)}
          className={cn("h-8 text-sm", className)}
        />
      )
    }

    case 'select':
      return (
        <Select
          value={value || ''}
          onValueChange={(val) => onChange(val || null)}
          disabled={loadingOptions}
        >
          <SelectTrigger className={cn("h-8 text-sm", className)}>
            <SelectValue placeholder={loadingOptions ? "加载中..." : `请选择${fieldConfig.label}`} />
          </SelectTrigger>
          <SelectContent>
            {selectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
          className={cn(
            "flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          rows={2}
        />
      )

    default:
      // 默认显示为文本输入
      return (
        <Input
          type="text"
          value={value?.toString() || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
          className={cn("h-8 text-sm", className)}
        />
      )
  }
}

