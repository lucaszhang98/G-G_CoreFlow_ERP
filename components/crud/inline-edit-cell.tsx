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
import { LocationSelect } from "@/components/ui/location-select"
import { FuzzySearchSelect, FuzzySearchOption } from "@/components/ui/fuzzy-search-select"
import { ChevronDown, Check, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

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
  
  // 失去焦点时同步到外部状态
  const handleBlur = React.useCallback(() => {
    if (internalValue !== value) {
      onChange(internalValue)
    }
  }, [internalValue, value, onChange])

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
      // 对于备注字段，使用 textarea
      if (fieldKey === 'notes') {
        return (
          <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
            <Textarea
              value={internalValue || ''}
              onChange={(e) => handleInternalChange(e.target.value)}
              onBlur={handleBlur}
              placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
              className={cn("min-h-[80px] text-sm min-w-[200px] w-full resize-none", className)}
              rows={3}
            />
          </div>
        )
      }
      return (
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <Input
            type={fieldConfig.type === 'email' ? 'email' : fieldConfig.type === 'phone' ? 'tel' : 'text'}
            value={internalValue || ''}
            onChange={(e) => handleInternalChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={fieldConfig.placeholder || `请输入${fieldConfig.label}`}
            className={cn("h-9 text-sm min-w-[120px] w-full", className)}
          />
        </div>
      )

    case 'number':
    case 'currency':
      // 0 为有效值，展示与入库管理详情页一致；空输入用 ''
      const numDisplayValue = internalValue === '' || internalValue === undefined || internalValue === null ? '' : internalValue
      return (
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <Input
            type="number"
            step={fieldConfig.type === 'currency' ? '0.01' : '1'}
            value={numDisplayValue}
            onChange={(e) => handleInternalChange(e.target.value === '' ? '' : Number(e.target.value))}
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
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell flex items-center gap-1">
          <Input
            type="date"
            value={dateValue}
            onChange={(e) => handleInternalChange(e.target.value || null)}
            onBlur={handleBlur}
            className={cn("h-9 text-sm min-w-[140px] flex-1 bg-white", className)}
          />
          {internalValue && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleInternalChange(null)
                onChange(null)
              }}
              title="清空日期"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )

    case 'datetime': {
      // 对于 pickup_date 字段，使用日期+小时选择器（分钟固定为00）
      if (fieldKey === 'pickup_date') {
        // 解析日期和小时
        let datePart = ''
        let hourPart = '00'
        if (internalValue) {
          let datetimeStr = ''
          if (internalValue instanceof Date) {
            // 使用 UTC 时间，避免时区问题
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
        }
        
        // 生成0-23小时选项
        const hourOptions = Array.from({ length: 24 }, (_, i) => {
          const hour = String(i).padStart(2, '0')
          return { label: `${hour}:00`, value: hour }
        })
        
        return (
          <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell flex items-center gap-2">
            <Input
              type="date"
              value={datePart}
              onChange={(e) => {
                const newDate = e.target.value
                const newValue = newDate ? `${newDate}T${hourPart}:00` : null
                handleInternalChange(newValue)
              }}
              onBlur={handleBlur}
              className={cn("h-9 text-sm min-w-[140px] flex-1 bg-white", className)}
            />
            <Select
              value={hourPart}
              onValueChange={(newHour) => {
                const newValue = datePart ? `${datePart}T${newHour}:00` : null
                handleInternalChange(newValue)
                // Select 组件值改变时立即同步到外部
                onChange(newValue)
              }}
            >
              <SelectTrigger className="w-24 h-9 text-sm bg-white">
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
          </div>
        )
      }
      
      // 其他日期时间字段：显示和编辑都使用 YYYY-MM-DDTHH:mm 格式
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
            className={cn("h-9 text-sm min-w-[160px] w-full bg-white", className)}
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
      // 对于 current_location 字段，使用 combobox 组件，支持自定义输入和下拉选择
      if (fieldKey === 'current_location') {
        const [open, setOpen] = React.useState(false)
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
          <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={open}
                  className={cn(
                    "flex h-9 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                    className
                  )}
                  onBlur={handleBlur}
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
                          setOpen(false)
                          setTimeout(() => handleBlur(), 100)
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
        <div onClick={(e) => e.stopPropagation()} className="inline-edit-cell">
          <Select
            value={internalValue || ''}
            onValueChange={(val) => {
              // 处理清空选项
              if (val === '__clear__') {
                handleInternalChange(null)
                onChange(null)
              } else {
                handleInternalChange(val || null)
                // Select 组件在值改变时立即同步到外部
                onChange(val || null)
              }
            }}
            disabled={loadingOptions}
          >
            <SelectTrigger className={cn("h-10 text-sm min-w-[120px] w-full", className)}>
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
                // 处理清空选项
                if (val === '__clear__') {
                  handleInternalChange(null)
                  onChange(null)
                } else {
                  handleInternalChange(val || null)
                  onChange(val || null) // 立即同步到外部
                }
              }}
              disabled={loadingOptions}
            >
              <SelectTrigger className={cn("h-10 text-sm min-w-[120px] w-full", className)}>
                <SelectValue placeholder={loadingOptions ? "加载中..." : `请选择${fieldConfig.label}`} />
              </SelectTrigger>
              <SelectContent>
                {selectOptions.length === 0 && !loadingOptions ? (
                  <SelectItem value="__disabled__" disabled>暂无选项</SelectItem>
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
