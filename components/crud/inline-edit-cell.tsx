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
import { LocationSelect } from "@/components/ui/location-select"
import { FuzzySearchSelect, FuzzySearchOption } from "@/components/ui/fuzzy-search-select"

interface InlineEditCellProps {
  fieldKey: string
  fieldConfig: FieldConfig
  value: any
  onChange: (value: any) => void
  className?: string
  loadOptions?: () => Promise<Array<{ label: string; value: string }>>
  loadFuzzyOptions?: (search: string) => Promise<FuzzySearchOption[]>
}

export function InlineEditCell({
  fieldKey,
  fieldConfig,
  value,
  onChange,
  className,
  loadOptions,
  loadFuzzyOptions,
}: InlineEditCellProps) {
  // 使用内部状态管理输入值，避免每次输入都触发外部状态更新
  // 对于 boolean 字段，需要特殊处理：false 是有效值，不应该被转换为 ''
  const getInitialValue = () => {
    if (fieldConfig.type === 'boolean') {
      return value !== undefined && value !== null ? Boolean(value) : false
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
    } else {
      setInternalValue(value || '')
    }
  }, [value, fieldConfig.type])
  
  // 处理输入变化：只更新内部状态，不触发外部更新
  const handleInternalChange = React.useCallback((newValue: any) => {
    setInternalValue(newValue)
  }, [])
  
  // 失去焦点时同步到外部状态
  const handleBlur = React.useCallback(() => {
    if (internalValue !== value) {
      onChange(internalValue)
    }
  }, [internalValue, value, onChange])

  // 异步加载选项（支持 select 和 relation 类型）
  React.useEffect(() => {
    if ((fieldConfig.type === 'select' || fieldConfig.type === 'relation') && loadOptions && selectOptions.length === 0 && !loadingOptions) {
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
  }, [fieldConfig.type, loadOptions, fieldKey, selectOptions.length, loadingOptions])

  // 根据字段类型渲染不同的输入控件
  switch (fieldConfig.type) {
    case 'text':
    case 'email':
    case 'phone':
      return (
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <Input
            type={fieldConfig.type === 'email' ? 'email' : fieldConfig.type === 'phone' ? 'tel' : 'text'}
            value={internalValue || ''}
            onChange={(e) => handleInternalChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
            className={cn("h-10 text-sm min-w-[120px] w-full", className)}
          />
        </div>
      )

    case 'number':
    case 'currency':
      return (
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <Input
            type="number"
            step={fieldConfig.type === 'currency' ? '0.01' : '1'}
            value={internalValue || ''}
            onChange={(e) => handleInternalChange(e.target.value ? Number(e.target.value) : '')}
            onBlur={handleBlur}
            placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
            className={cn("h-10 text-sm min-w-[100px] w-full", className)}
          />
        </div>
      )

    case 'date':
      // 处理日期：显示和编辑都使用 YYYY-MM-DD 格式
      const dateValue = internalValue 
        ? (internalValue instanceof Date 
          ? internalValue.toISOString().split("T")[0] 
          : typeof internalValue === 'string' 
          ? internalValue.split("T")[0] 
          : internalValue)
        : ''
      return (
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <Input
            type="date"
            value={dateValue}
            onChange={(e) => handleInternalChange(e.target.value || null)}
            onBlur={handleBlur}
            className={cn("h-10 text-sm min-w-[140px] w-full", className)}
          />
        </div>
      )

    case 'datetime': {
      // 处理日期时间：显示和编辑都使用 YYYY-MM-DDTHH:mm 格式
      // 避免使用 getTimezoneOffset() 以防止 hydration 错误
      let datetimeValue = ''
      if (internalValue) {
        if (internalValue instanceof Date) {
          // 使用 UTC 时间，避免时区问题
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
      return (
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <Input
            type="datetime-local"
            value={datetimeValue}
            onChange={(e) => handleInternalChange(e.target.value || null)}
            onBlur={handleBlur}
            className={cn("h-10 text-sm min-w-[140px] w-full", className)}
          />
        </div>
      )
    }

    case 'select':
    case 'badge':
      // badge 类型在编辑时也使用下拉框（如果有 options）
      if (fieldConfig.type === 'badge' && !fieldConfig.options) {
        // 如果没有 options，回退到默认处理
        break
      }
      return (
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <Select
            value={internalValue || ''}
            onValueChange={(val) => {
              handleInternalChange(val || null)
              // Select 组件在值改变时立即同步到外部
              onChange(val || null)
            }}
            disabled={loadingOptions}
          >
            <SelectTrigger className={cn("h-10 text-sm min-w-[120px] w-full", className)}>
              <SelectValue placeholder={loadingOptions ? "加载中..." : `请选择${fieldConfig.label}`} />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start" sideOffset={4}>
              {selectOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )

    case 'textarea':
      return (
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <textarea
            value={internalValue || ''}
            onChange={(e) => handleInternalChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
            className={cn(
              "flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            rows={2}
          />
        </div>
      )

    case 'boolean':
      // boolean 字段：确保 internalValue 是布尔类型
      const boolValue = typeof internalValue === 'boolean' 
        ? internalValue 
        : (internalValue === true || internalValue === 'true' || internalValue === 1 || internalValue === '1')
      return (
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <input
            type="checkbox"
            checked={boolValue}
            onChange={(e) => {
              const newValue = e.target.checked
              handleInternalChange(newValue)
              // Checkbox 立即同步到外部
              onChange(newValue)
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
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <LocationSelect
            value={internalValue || null}
            onChange={(val) => {
              handleInternalChange(val)
              onChange(val) // 立即同步到外部
            }}
            onBlur={handleBlur}
            placeholder={fieldConfig.placeholder || `请选择${fieldConfig.label}`}
            className={className} // 只传递外部className，不覆盖核心样式
            locationType={fieldConfig.locationType} // 支持直接指定位置类型
          />
        </div>
      )

    case 'relation':
      // 处理 locations 关联字段（使用 LocationSelect 组件 - 框架级复用组件）
      // 注意：不传递className来改变核心样式，保持统一的白色样式
      if (fieldConfig.relation?.model === 'locations') {
        return (
          <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
            <LocationSelect
              value={internalValue || null}
              onChange={(val) => {
                handleInternalChange(val)
                onChange(val) // 立即同步到外部
              }}
              onBlur={handleBlur}
              placeholder={fieldConfig.placeholder || `请选择${fieldConfig.label}`}
              className={className} // 只传递外部className，不覆盖核心样式
              locationType={fieldConfig.locationType} // 支持直接指定位置类型
            />
          </div>
        )
      }
      // 其他关联字段：优先使用模糊搜索下拉框（如果有 loadFuzzyOptions）
      if (loadFuzzyOptions) {
        return (
          <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
            <FuzzySearchSelect
              value={internalValue || null}
              onChange={(val) => {
                handleInternalChange(val)
                onChange(val) // 立即同步到外部
              }}
              onBlur={handleBlur}
              placeholder={fieldConfig.placeholder || `请选择${fieldConfig.label}`}
              className={className}
              loadOptions={loadFuzzyOptions}
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
          <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
            <Select
              value={internalValue || ''}
              onValueChange={(val) => {
                handleInternalChange(val || null)
                onChange(val || null) // 立即同步到外部
              }}
              disabled={loadingOptions}
            >
              <SelectTrigger className={cn("h-10 text-sm min-w-[120px] w-full", className)}>
                <SelectValue placeholder={loadingOptions ? "加载中..." : `请选择${fieldConfig.label}`} />
              </SelectTrigger>
              <SelectContent>
                {selectOptions.length === 0 && !loadingOptions ? (
                  <SelectItem value="" disabled>暂无选项</SelectItem>
                ) : (
                  selectOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )
      }
      // 如果没有 loadOptions 和 loadFuzzyOptions，使用默认处理
      break

    default:
      // 默认显示为文本输入
      return (
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <Input
            type="text"
            value={internalValue?.toString() || ''}
            onChange={(e) => handleInternalChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
            className={cn("h-8 text-sm", className)}
          />
        </div>
      )
  }
}
