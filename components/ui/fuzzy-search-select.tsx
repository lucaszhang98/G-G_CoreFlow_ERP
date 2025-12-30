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

  // 当有值但选项不在列表中时，需要加载该选项（用于显示已选中的值）
  const [selectedOptionCache, setSelectedOptionCache] = React.useState<FuzzySearchOption | null>(null)
  const [isLoadingSelected, setIsLoadingSelected] = React.useState(false)
  
  React.useEffect(() => {
    if (value && !selectedOption && !selectedOptionCache && !isLoadingSelected) {
      // 有值但不在当前选项中，尝试加载
      setIsLoadingSelected(true)
      loadOptions('')
        .then(results => {
          const found = results.find((opt) => String(opt.value) === String(value))
          if (found) {
            setSelectedOptionCache(found)
            // 同时更新 options，确保后续能找到
            setOptions(prev => {
              const exists = prev.find(opt => String(opt.value) === String(value))
              if (exists) return prev
              return [...prev, found]
            })
          } else {
            // 如果找不到，可能是值无效，清空缓存
            console.warn(`[FuzzySearchSelect] 找不到值为 ${value} 的选项`)
            setSelectedOptionCache(null)
          }
        })
        .catch(err => {
          console.error('[FuzzySearchSelect] 加载选中选项失败:', err)
          setSelectedOptionCache(null)
        })
        .finally(() => {
          setIsLoadingSelected(false)
        })
    } else if (!value) {
      // 值被清空时，清空缓存
      setSelectedOptionCache(null)
    } else if (selectedOption) {
      // 如果找到了，更新缓存
      setSelectedOptionCache(selectedOption)
    }
  }, [value, selectedOption, selectedOptionCache, loadOptions, isLoadingSelected])

  // 搜索选项 - 优化防抖和状态管理，避免闪烁和跳动
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const lastSearchQueryRef = React.useRef<string>("")
  const isLoadingRef = React.useRef(false) // 使用 ref 跟踪加载状态，避免状态更新导致的闪烁
  
  React.useEffect(() => {
    if (!open) {
      // 关闭时清空搜索词和选项列表
      setSearchQuery("")
      lastSearchQueryRef.current = ""
      setOptions([])
      setLoading(false)
      isLoadingRef.current = false
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
      return
    }
    
    // 打开时，无论是否有值，都立即加载所有选项
    if (options.length === 0 && !searchQuery && !isLoadingRef.current) {
      setLoading(true)
      isLoadingRef.current = true
      loadOptions('')
        .then(results => {
          setOptions(results)
          lastSearchQueryRef.current = ""
        })
        .catch(error => {
          console.error('加载选项失败:', error)
          setOptions([])
        })
        .finally(() => {
          setLoading(false)
          isLoadingRef.current = false
        })
    }

    // 如果搜索词没变，不重新加载
    if (searchQuery === lastSearchQueryRef.current) {
      return
    }

    // 清除之前的定时器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }

    // 只有在搜索词改变时才显示 loading（避免初始加载时的闪烁）
    // 并且只有在有搜索词时才显示 loading（空搜索不显示 loading）
    const shouldShowLoading = searchQuery !== lastSearchQueryRef.current && searchQuery !== "" && !isLoadingRef.current
    
    if (shouldShowLoading) {
      setLoading(true)
      isLoadingRef.current = true
    }
    
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await loadOptions(searchQuery)
        // 只有在搜索词仍然是当前搜索词时才更新（避免竞态条件）
        if (searchQuery === lastSearchQueryRef.current || searchQuery !== lastSearchQueryRef.current) {
          setOptions(results)
          lastSearchQueryRef.current = searchQuery
        }
      } catch (error) {
        console.error('加载选项失败:', error)
        setOptions([])
      } finally {
        setLoading(false)
        isLoadingRef.current = false
      }
    }, 500) // 增加防抖时间到 500ms，减少跳动
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
    }
  }, [searchQuery, open, loadOptions])
  
  // 打开时加载初始数据（无论是否有值，都加载所有选项）
  const initialLoadDoneRef = React.useRef(false)
  React.useEffect(() => {
    if (open && !initialLoadDoneRef.current && !searchQuery) {
      initialLoadDoneRef.current = true
      setLoading(true)
      isLoadingRef.current = true
      loadOptions('')
        .then(results => {
          setOptions(results)
          lastSearchQueryRef.current = ""
        })
        .catch(error => {
          console.error('加载初始选项失败:', error)
          setOptions([])
        })
        .finally(() => {
          setLoading(false)
          isLoadingRef.current = false
        })
    } else if (!open) {
      // 关闭时重置初始加载标志
      initialLoadDoneRef.current = false
    }
  }, [open, loadOptions, searchQuery])

  const handleSelect = React.useCallback((optionValue: string | number) => {
    // 如果点击的是已选中的选项，则取消选择
    if (String(value) === String(optionValue)) {
      onChange?.(null)
      setSelectedOptionCache(null)
      setOpen(false)
      setSearchQuery("")
      return
    }
    // 找到选中的选项并缓存
    const selected = options.find(opt => String(opt.value) === String(optionValue))
    if (selected) {
      setSelectedOptionCache(selected)
    }
    onChange?.(optionValue)
    setOpen(false)
    setSearchQuery("")
  }, [onChange, options, value])

  // 显示值（优先使用 selectedOption，如果不存在则使用缓存）
  const displayOption = selectedOption || selectedOptionCache
  // 如果有值但没有找到选项，显示加载中或占位符，而不是显示 ID
  // 只有在找到选项时才显示 label，否则显示占位符或加载中
  let displayText: string
  if (displayValue) {
    displayText = displayValue(displayOption)
  } else if (displayOption?.label) {
    // 找到了选项，显示 label
    displayText = displayOption.label
  } else if (value && isLoadingSelected) {
    // 正在加载选中选项
    displayText = loadingText
  } else if (value) {
    // 有值但找不到选项，显示占位符（不显示 ID）
    displayText = placeholder
  } else {
    // 没有值，显示占位符
    displayText = placeholder
  }

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
            {loading && options.length === 0 ? (
              <div className="py-8 text-center">
                <div className="inline-flex items-center gap-2.5 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                  <span>{loadingText}</span>
                </div>
              </div>
            ) : !loading && options.length === 0 && searchQuery ? (
              <div className="py-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                  <Search className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">未找到匹配的结果</p>
                <p className="text-xs text-muted-foreground">请尝试其他搜索关键词</p>
              </div>
            ) : null}
            {!loading && options.length > 0 && (
              <CommandGroup>
                {options.map((option, index) => {
                const isSelected = String(value) === String(option.value)
                return (
                  <div
                    key={String(option.value) || `option-${index}`}
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
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

