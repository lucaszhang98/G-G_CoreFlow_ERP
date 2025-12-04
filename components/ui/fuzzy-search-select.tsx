/**
 * 通用模糊搜索下拉框组件
 * 支持可点击的结果列表，类似 LocationSelect 的交互模式
 */

"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface FuzzySearchOption {
  value: string | number
  label: string
  description?: string
  metadata?: Record<string, any>
}

interface FuzzySearchSelectProps {
  value?: string | number | null
  onChange?: (value: string | number | null) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
  searchPlaceholder?: string
  emptyText?: string
  loadingText?: string
  loadOptions: (search: string) => Promise<FuzzySearchOption[]>
  displayValue?: (option: FuzzySearchOption | null) => string
  icon?: React.ReactNode
}

export function FuzzySearchSelect({
  value,
  onChange,
  onBlur,
  placeholder = "搜索并选择...",
  className,
  disabled = false,
  searchPlaceholder = "搜索...",
  emptyText = "未找到结果",
  loadingText = "搜索中...",
  loadOptions,
  displayValue,
  icon,
}: FuzzySearchSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [options, setOptions] = React.useState<FuzzySearchOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // 获取选中的选项
  const selectedOption = React.useMemo(() => {
    if (!value) return null
    return options.find((opt) => String(opt.value) === String(value)) || null
  }, [value, options])

  // 搜索选项
  React.useEffect(() => {
    if (open && searchQuery !== undefined) {
      const timeoutId = setTimeout(async () => {
        setLoading(true)
        try {
          const results = await loadOptions(searchQuery)
          setOptions(results)
        } catch (error) {
          console.error('加载选项失败:', error)
          setOptions([])
        } finally {
          setLoading(false)
        }
      }, 300) // 防抖 300ms
      return () => clearTimeout(timeoutId)
    } else if (open && !searchQuery) {
      // 打开时如果没有搜索词，加载空结果或初始结果
      setLoading(true)
      loadOptions('')
        .then(results => setOptions(results))
        .catch(error => {
          console.error('加载选项失败:', error)
          setOptions([])
        })
        .finally(() => setLoading(false))
    }
  }, [searchQuery, open, loadOptions])

  const handleSelect = React.useCallback((optionValue: string | number) => {
    onChange?.(optionValue)
    setOpen(false)
    setSearchQuery("")
  }, [onChange])

  // 显示值
  const displayText = displayValue 
    ? displayValue(selectedOption)
    : (selectedOption?.label || placeholder)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            // 基础样式 - 统一白色样式，与 LocationSelect 保持一致
            "w-full justify-between h-9 font-medium transition-all duration-200",
            "border border-input/50 bg-white shadow-sm",
            "hover:border-input hover:bg-gray-50/50",
            "focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500",
            "text-muted-foreground",
            // 打开状态
            open && "ring-2 ring-blue-500/20 border-blue-500 shadow-md",
            // 禁用状态
            disabled && "opacity-50 cursor-not-allowed",
            // 外部传入的className只用于覆盖宽度等，不改变核心样式
            className
          )}
          disabled={disabled}
          onBlur={onBlur}
        >
          <span className="truncate flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-muted/50 text-muted-foreground flex-shrink-0">
                {icon}
              </span>
            )}
            <span className="font-medium truncate text-muted-foreground">
              {displayText}
            </span>
          </span>
          <ChevronsUpDown className={cn(
            "ml-2 h-4 w-4 shrink-0 transition-all duration-200 flex-shrink-0 text-muted-foreground/60",
            open && "rotate-180"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[420px] p-0" 
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <div className="border-b bg-gradient-to-br from-blue-50 via-indigo-50/80 to-purple-50/50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/20 p-4 shadow-sm">
            <div className="text-sm font-semibold mb-3.5 text-foreground flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                <Search className="h-3.5 w-3.5" />
              </div>
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                搜索
              </span>
            </div>
            <div className="border-b bg-background/50 backdrop-blur-sm">
              <div className="flex items-center px-4 py-3">
                <div className="p-1.5 rounded-md bg-muted/50 mr-2.5">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex h-9 w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:placeholder:text-muted-foreground/40 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </div>
          
          <CommandList className="max-h-[280px] overflow-y-auto overflow-x-hidden">
            {loading ? (
              <div className="py-8 text-center">
                <div className="inline-flex items-center gap-2.5 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                  <span>{loadingText}</span>
                </div>
              </div>
            ) : options.length === 0 && searchQuery ? (
              <div className="py-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                  <Search className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">未找到匹配的结果</p>
                <p className="text-xs text-muted-foreground">请尝试其他搜索关键词</p>
              </div>
            ) : null}
            <CommandGroup>
              {options.map((option) => {
                const isSelected = String(value) === String(option.value)
                return (
                  <div
                    key={String(option.value)}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 mx-1.5 my-0.5 text-sm outline-none transition-all duration-200",
                      "hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-950/30 dark:hover:to-indigo-950/20",
                      "hover:shadow-sm hover:border hover:border-blue-200/50 dark:hover:border-blue-800/50",
                      isSelected && "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-300/50 dark:border-blue-700/50 shadow-sm"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelect(option.value)
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelect(option.value)
                    }}
                  >
                    <div className={cn(
                      "mr-3 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-all duration-200",
                      isSelected 
                        ? "border-blue-600 bg-blue-600" 
                        : "border-muted-foreground/30 bg-background"
                    )}>
                      {isSelected && (
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className={cn(
                        "font-semibold text-sm truncate",
                        isSelected ? "text-blue-700 dark:text-blue-300" : "text-foreground"
                      )}>
                        {option.label}
                      </span>
                      {option.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

