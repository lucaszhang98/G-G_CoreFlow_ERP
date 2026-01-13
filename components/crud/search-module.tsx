"use client"

/**
 * 专业搜索模块组件
 * 统一整合简单搜索、筛选和高级搜索功能
 * 现代化、专业的UI设计
 */

import * as React from "react"
import { Search, Filter, X, ChevronDown, SlidersHorizontal, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { FilterFieldConfig, AdvancedSearchFieldConfig } from "@/lib/crud/types"
import { AdvancedSearchDialog } from "./advanced-search-dialog"
import { FuzzySearchSelect, FuzzySearchOption } from "@/components/ui/fuzzy-search-select"
import { LocationSelect } from "@/components/ui/location-select"

interface SearchModuleProps {
  // 简单搜索
  searchPlaceholder?: string
  searchValue: string
  onSearchChange: (value: string) => void
  total?: number
  
  // 筛选
  filterFields?: FilterFieldConfig[]
  filterValues: Record<string, any>
  onFilterChange: (field: string, value: any) => void
  onClearFilters: () => void
  
  // 高级搜索
  advancedSearchFields?: AdvancedSearchFieldConfig[]
  advancedSearchOpen: boolean
  onAdvancedSearchOpenChange: (open: boolean) => void
  advancedSearchValues: Record<string, any>
  advancedSearchLogic: 'AND' | 'OR'
  onAdvancedSearchChange: (field: string, value: any) => void
  onAdvancedSearchLogicChange: (logic: 'AND' | 'OR') => void
  onAdvancedSearch: () => void
  onResetAdvancedSearch: () => void
  
  // 字段模糊搜索加载函数（用于 relation 类型的 filter）
  fieldFuzzyLoadOptions?: Record<string, (search: string) => Promise<FuzzySearchOption[]>>
}

export function SearchModule({
  searchPlaceholder = "搜索...",
  searchValue,
  onSearchChange,
  total = 0,
  filterFields = [],
  filterValues,
  onFilterChange,
  onClearFilters,
  advancedSearchFields = [],
  advancedSearchOpen,
  onAdvancedSearchOpenChange,
  advancedSearchValues,
  advancedSearchLogic,
  onAdvancedSearchChange,
  onAdvancedSearchLogicChange,
  onAdvancedSearch,
  onResetAdvancedSearch,
  fieldFuzzyLoadOptions,
}: SearchModuleProps) {
  // 只在客户端挂载后渲染 Radix UI 组件，避免 hydration 错误
  const [mounted, setMounted] = React.useState(false)
  
  React.useEffect(() => {
    setMounted(true)
  }, [])
  
  // 维护筛选选项映射（用于显示标签）
  const [filterOptionsMap, setFilterOptionsMap] = React.useState<Record<string, Record<string, string>>>({})
  // 维护关系字段的标签映射（用于显示关系字段的筛选标签）
  const [relationFilterLabelsMap, setRelationFilterLabelsMap] = React.useState<Record<string, Record<string, string>>>({})
  
  // 稳定 advancedSearchFields 的引用，避免 React 静态标志错误
  const stableAdvancedSearchFields = React.useMemo(() => {
    return advancedSearchFields || []
  }, [advancedSearchFields])
  
  // 生成稳定的 key，用于 AdvancedSearchDialog 组件
  const advancedSearchKey = React.useMemo(() => {
    return stableAdvancedSearchFields.map(f => f.field).join(',')
  }, [stableAdvancedSearchFields])
  
  // 加载关系字段标签的辅助函数
  const loadRelationFieldLabel = React.useCallback(async (
    filter: FilterFieldConfig,
    value: string | number,
    loadFuzzyOptions: (search: string) => Promise<FuzzySearchOption[]>
  ) => {
    try {
      // 对于 locations 模型，直接通过 ID 获取详情（更高效且确保能获取到 location_code）
      if (filter.relation?.model === 'locations') {
        try {
          const response = await fetch(`/api/locations/${value}`)
          if (response.ok) {
            const data = await response.json()
            const location = data.data || data
            const displayField = filter.relation.displayField || 'location_code'
            const label = location[displayField] || location.location_code || location.name || String(value)
            setRelationFilterLabelsMap((prev) => ({
              ...prev,
              [filter.field]: {
                ...prev[filter.field],
                [String(value)]: label,
              },
            }))
            return
          }
        } catch (error) {
          console.error(`通过 ID 加载${filter.label}标签失败，尝试使用模糊搜索:`, error)
        }
      }
      
      // 对于其他模型，使用模糊搜索选项
      const options = await loadFuzzyOptions('')
      const selectedOption = options.find(opt => String(opt.value) === String(value))
      if (selectedOption) {
        setRelationFilterLabelsMap((prev) => ({
          ...prev,
          [filter.field]: {
            ...prev[filter.field],
            [String(value)]: selectedOption.label,
          },
        }))
      }
    } catch (error) {
      console.error(`加载${filter.label}标签失败:`, error)
    }
  }, [])
  
  // 在组件顶层统一处理关系字段标签的加载
  React.useEffect(() => {
    if (!mounted) return
    
    filterFields.forEach((filter) => {
      if (filter.type === 'select' && filter.relation) {
        const currentValue = filterValues[filter.field]
        if (currentValue && currentValue !== '__all__' && !relationFilterLabelsMap[filter.field]?.[String(currentValue)]) {
          // 需要加载标签
          // 优先使用 fieldFuzzyLoadOptions（如果有），否则使用通用 API
          const loadFuzzyOptions = fieldFuzzyLoadOptions?.[filter.field] || (async (search: string): Promise<FuzzySearchOption[]> => {
            try {
              const params = new URLSearchParams()
              if (search) {
                params.append('search', search)
              }
              params.append('unlimited', 'true')
              const modelName = filter.relation!.model
              const apiPath = `/api/${modelName}?${params.toString()}`
              const response = await fetch(apiPath)
              if (!response.ok) {
                throw new Error(`加载${filter.label}选项失败`)
              }
              const data = await response.json()
              const items = data.data || []
              const displayField = filter.relation!.displayField
              const valueField = filter.relation!.valueField || 'id'
              return items.map((item: any) => {
                const itemValue = item[valueField] !== undefined ? item[valueField] : item.id
                const itemLabel = item[displayField] || String(itemValue || '')
                return {
                  value: String(itemValue || ''),
                  label: itemLabel,
                  description: item[displayField] || undefined,
                }
              })
            } catch (error) {
              console.error(`加载${filter.label}选项失败:`, error)
              return []
            }
          })
          
          loadRelationFieldLabel(filter, currentValue, loadFuzzyOptions)
        }
      }
    })
  }, [mounted, filterFields, filterValues, relationFilterLabelsMap, loadRelationFieldLabel, fieldFuzzyLoadOptions])

  // 计算活跃的筛选数量（考虑范围类型）
  const activeFilterCount = React.useMemo(() => {
    if (!filterFields.length) return 0
    
    let count = 0
    filterFields.forEach((filter) => {
      if (filter.type === 'select') {
        const value = filterValues[filter.field]
        if (value && value !== '__all__') {
          count++
        }
      } else if (filter.type === 'dateRange') {
        const from = filterValues[`${filter.field}_from`]
        const to = filterValues[`${filter.field}_to`]
        if (from || to) {
          count++
        }
      } else if (filter.type === 'numberRange') {
        const min = filterValues[`${filter.field}_min`]
        const max = filterValues[`${filter.field}_max`]
        if (min || max) {
          count++
        }
      }
    })
    return count
  }, [filterValues, filterFields])

  // 计算活跃的高级搜索条件数量
  const activeAdvancedSearchCount = React.useMemo(() => {
    return Object.values(advancedSearchValues).filter(
      (v) => v !== null && v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true)
    ).length
  }, [advancedSearchValues])

  const hasActiveFilters = activeFilterCount > 0
  const hasActiveAdvancedSearch = activeAdvancedSearchCount > 0
  // 只在客户端挂载后计算 hasAnyFilters，避免 hydration 错误
  const hasAnyFilters = mounted && (hasActiveFilters || hasActiveAdvancedSearch || searchValue)

  return (
    <div className="space-y-4">
      {/* 主搜索区域 */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative bg-white dark:bg-gray-900/50 border border-gray-200/60 dark:border-gray-800/60 rounded-2xl shadow-lg shadow-gray-900/5 dark:shadow-gray-900/20 p-4 backdrop-blur-sm">
          {/* 搜索框行 */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-3">
            {/* 主要搜索框 */}
            <div className="relative flex-1 group/search">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 rounded-xl opacity-0 group-hover/search:opacity-100 transition-opacity duration-200" />
              <div className="relative flex items-center">
                <div className="absolute left-4 z-10 pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 dark:text-gray-500 transition-colors group-hover/search:text-blue-500" />
                </div>
                <Input
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-12 pr-4 h-14 text-base border-2 border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900/50 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700"
                />
                {mounted && searchValue && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onSearchChange('')}
                      className="h-8 w-8 rounded-lg hover:bg-gray-200/80 dark:hover:bg-gray-800/80"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {/* 搜索结果提示 */}
              {mounted && searchValue && (
                <div className="absolute left-4 top-full mt-2 text-xs text-gray-500 dark:text-gray-400 animate-in fade-in slide-in-from-top-1">
                  找到 <span className="font-semibold text-blue-600 dark:text-blue-400">{total}</span> 条结果
                </div>
              )}
            </div>

            {/* 操作按钮组 */}
            <div className="flex items-center gap-2 shrink-0">
              {/* 高级搜索按钮 */}
              {stableAdvancedSearchFields.length > 0 && (
                <Button
                  variant={hasActiveAdvancedSearch ? "default" : "outline"}
                  onClick={() => onAdvancedSearchOpenChange(true)}
                  className={`
                    h-14 px-6 rounded-xl font-medium transition-all duration-200
                    ${hasActiveAdvancedSearch 
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25" 
                      : "border-2 border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-600 bg-white dark:bg-gray-900/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                    }
                  `}
                >
                  <SlidersHorizontal className={`h-4 w-4 mr-2 ${hasActiveAdvancedSearch ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                  <span className={hasActiveAdvancedSearch ? 'text-white' : 'text-gray-700 dark:text-gray-300'}>
                    高级搜索
                  </span>
                  {hasActiveAdvancedSearch && (
                    <Badge 
                      variant="secondary" 
                      className="ml-2 h-5 min-w-5 px-1.5 bg-white/20 text-white border-0"
                    >
                      {activeAdvancedSearchCount}
                    </Badge>
                  )}
                </Button>
              )}

              {/* 清除所有筛选按钮 */}
              {hasAnyFilters && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onSearchChange('')
                    onClearFilters()
                    onResetAdvancedSearch()
                  }}
                  className="h-14 px-4 rounded-xl border-2 border-gray-200 dark:border-gray-800 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all duration-200"
                >
                  <X className="h-4 w-4 mr-2 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">清除</span>
                </Button>
              )}
            </div>
          </div>

          {/* 快速筛选区域 */}
          {filterFields.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-800/60">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 shrink-0">
                  <Filter className="h-4 w-4" />
                  <span className="font-medium">快速筛选</span>
                </div>
                
                {filterFields.map((filter) => {
                  // 如果是 location 类型的筛选字段（relation.model === 'locations'），使用 LocationSelect（分步选择）
                  if (filter.type === 'select' && filter.relation && filter.relation.model === 'locations') {
                    // 从 filter.locationType 获取位置类型，用于过滤选项
                    const locationType = filter.locationType
                    const currentValue = filterValues[filter.field]
                    const isActive = currentValue && currentValue !== '__all__' && currentValue !== null && currentValue !== ''
                    
                    // 只在客户端挂载后渲染 LocationSelect，避免 hydration 错误
                    if (!mounted) {
                      return (
                        <Button
                          key={filter.field}
                          variant="outline"
                          className={`
                            h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200
                            ${isActive
                              ? "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-md shadow-indigo-500/20"
                              : "border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                            }
                          `}
                          disabled
                        >
                          <span className="truncate">{filter.label}</span>
                          <ChevronDown className="ml-2 h-3 w-3 opacity-70 shrink-0" />
                        </Button>
                      )
                    }
                    
                    // 当值改变时，更新标签映射
                    const handleLocationFilterChange = async (value: string | number | null) => {
                      onFilterChange(filter.field, value || null)
                      
                      // 如果有值，加载对应的标签（通过 LocationSelect 的 API）
                      if (value) {
                        try {
                          const response = await fetch(`/api/locations/${value}`)
                          if (response.ok) {
                            const location = await response.json()
                            const label = location.location_code || location.name || String(value)
                            setRelationFilterLabelsMap((prev) => ({
                              ...prev,
                              [filter.field]: {
                                ...(prev[filter.field] || {}),
                                [String(value)]: label,
                              },
                            }))
                          }
                        } catch (error) {
                          console.error(`加载${filter.label}标签失败:`, error)
                        }
                      } else {
                        // 清空时，清除该字段的映射
                        setRelationFilterLabelsMap((prev) => {
                          const newMap = { ...prev }
                          delete newMap[filter.field]
                          return newMap
                        })
                      }
                    }
                    
                    return (
                      <div key={filter.field} className="relative">
                        <LocationSelect
                          value={currentValue || null}
                          onChange={handleLocationFilterChange}
                          placeholder={filter.label}
                          locationType={locationType} // 传递 locationType 以过滤位置选项
                          className={`
                            h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200
                            ${isActive
                              ? "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-md shadow-indigo-500/20"
                              : "border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                            }
                          `}
                        />
                        {isActive && (
                          <Badge 
                            variant="secondary" 
                            className="absolute -top-2 -right-2 h-4 min-w-4 px-1 bg-white/20 text-white border-0 shrink-0 z-10"
                          >
                            1
                          </Badge>
                        )}
                      </div>
                    )
                  }
                  
                  // 如果是其他 relation 类型的筛选字段，使用模糊搜索下拉框
                  if (filter.type === 'select' && filter.relation) {
                    const currentValue = filterValues[filter.field]
                    const isActive = currentValue && currentValue !== '__all__' && currentValue !== null && currentValue !== ''
                    
                    // 创建模糊搜索加载函数
                    // 优先使用 fieldFuzzyLoadOptions（如果有），否则使用通用 API
                    const loadFuzzyOptions = fieldFuzzyLoadOptions?.[filter.field] || (async (search: string): Promise<FuzzySearchOption[]> => {
                      try {
                        const params = new URLSearchParams()
                        if (search) {
                          params.append('search', search)
                        }
                        params.append('unlimited', 'true')
                        const modelName = filter.relation!.model
                        const apiPath = `/api/${modelName}?${params.toString()}`
                        const response = await fetch(apiPath)
                        if (!response.ok) {
                          throw new Error(`加载${filter.label}选项失败`)
                        }
                        const data = await response.json()
                        const items = data.data || []
                        const displayField = filter.relation!.displayField
                        const valueField = filter.relation!.valueField || 'id'
                        return items.map((item: any) => {
                          const itemValue = item[valueField] !== undefined ? item[valueField] : item.id
                          const itemLabel = item[displayField] || String(itemValue || '')
                          return {
                            value: String(itemValue || ''),
                            label: itemLabel,
                            description: item[displayField] || undefined,
                          }
                        })
                      } catch (error) {
                        console.error(`加载${filter.label}选项失败:`, error)
                        return []
                      }
                    })
                    
                    // 只在客户端挂载后渲染 FuzzySearchSelect，避免 hydration 错误
                    if (!mounted) {
                      return (
                        <Button
                          key={filter.field}
                          variant="outline"
                          className={`
                            h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200
                            ${isActive
                              ? "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-md shadow-indigo-500/20"
                              : "border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                            }
                          `}
                          disabled
                        >
                          <span className="truncate">{filter.label}</span>
                          <ChevronDown className="ml-2 h-3 w-3 opacity-70 shrink-0" />
                        </Button>
                      )
                    }
                    
                    // 当值改变时，更新标签映射（不使用 useCallback，避免违反 Hooks 规则）
                    const handleRelationFilterChange = async (value: string | number | null) => {
                      onFilterChange(filter.field, value || null)
                      
                      // 如果有值，加载对应的标签
                      if (value) {
                        loadRelationFieldLabel(filter, value, loadFuzzyOptions)
                      } else {
                        // 清空时，清除该字段的映射
                        setRelationFilterLabelsMap((prev) => {
                          const newMap = { ...prev }
                          delete newMap[filter.field]
                          return newMap
                        })
                      }
                    }
                    
                    return (
                      <div key={filter.field} className="relative">
                        <FuzzySearchSelect
                          value={currentValue || null}
                          onChange={handleRelationFilterChange}
                          placeholder={filter.label}
                          loadOptions={loadFuzzyOptions}
                          className={`
                            h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200
                            ${isActive
                              ? "border-indigo-200 dark:border-indigo-600 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 shadow-sm"
                              : "border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                            }
                          `}
                        />
                        {isActive && (
                          <Badge 
                            variant="secondary" 
                            className="absolute -top-2 -right-2 h-4 min-w-4 px-1 bg-indigo-500 text-white border-0 shrink-0 z-10"
                          >
                            1
                          </Badge>
                        )}
                      </div>
                    )
                  }
                  
                  // 普通 select 类型（静态选项或动态加载选项）
                  if (filter.type === 'select') {
                    return (
                      <SelectFilterField
                        key={filter.field}
                        filter={filter}
                        currentValue={filterValues[filter.field]}
                        onFilterChange={onFilterChange}
                        mounted={mounted}
                        filterOptionsMap={filterOptionsMap}
                        setFilterOptionsMap={setFilterOptionsMap}
                      />
                    )
                  }
                  
                  // 其他类型的筛选字段（dateRange, numberRange 等）
                  if (filter.type === 'dateRange') {
                    const fromValue = filterValues[`${filter.field}_from`]
                    const toValue = filterValues[`${filter.field}_to`]
                    const isActive = fromValue || toValue

                    // 只在客户端挂载后渲染 Popover，避免 hydration 错误
                    if (!mounted) {
                      return (
                        <Button
                          key={filter.field}
                          variant="outline"
                          className={`
                            h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200
                            ${isActive
                              ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md shadow-cyan-500/20"
                              : "border-gray-200 dark:border-gray-800 hover:border-cyan-400 dark:hover:border-cyan-600 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20"
                            }
                          `}
                          disabled
                        >
                          {filter.label}
                          <ChevronDown className="ml-2 h-3 w-3 opacity-70" />
                        </Button>
                      )
                    }

                    return (
                      <Popover key={filter.field}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`
                              h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200
                              ${isActive
                                ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md shadow-cyan-500/20"
                                : "border-gray-200 dark:border-gray-800 hover:border-cyan-400 dark:hover:border-cyan-600 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20"
                              }
                            `}
                          >
                            {filter.label}
                            <ChevronDown className="ml-2 h-3 w-3 opacity-70" />
                            {isActive && (
                              <Badge 
                                variant="secondary" 
                                className="ml-2 h-4 min-w-4 px-1 bg-white/20 text-white border-0"
                              >
                                1
                              </Badge>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4" align="start">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 w-16 shrink-0">
                                开始日期
                              </Label>
                              <Input
                                type="date"
                                value={fromValue || ''}
                                onChange={(e) => onFilterChange(`${filter.field}_from`, e.target.value || null)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 w-16 shrink-0">
                                结束日期
                              </Label>
                              <Input
                                type="date"
                                value={toValue || ''}
                                onChange={(e) => onFilterChange(`${filter.field}_to`, e.target.value || null)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  onFilterChange(`${filter.field}_from`, null)
                                  onFilterChange(`${filter.field}_to`, null)
                                }}
                                className="h-7 text-xs"
                              >
                                清除
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )
                  }
                  
                  if (filter.type === 'numberRange') {
                    const minValue = filterValues[`${filter.field}_min`]
                    const maxValue = filterValues[`${filter.field}_max`]
                    const isActive = minValue || maxValue

                    // 只在客户端挂载后渲染 Popover，避免 hydration 错误
                    if (!mounted) {
                      return (
                        <Button
                          key={filter.field}
                          variant="outline"
                          className={`
                            h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200
                            ${isActive
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md shadow-emerald-500/20"
                              : "border-gray-200 dark:border-gray-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                            }
                          `}
                          disabled
                        >
                          {filter.label}
                          <ChevronDown className="ml-2 h-3 w-3 opacity-70" />
                        </Button>
                      )
                    }

                    return (
                      <Popover key={filter.field}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`
                              h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200
                              ${isActive
                                ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md shadow-emerald-500/20"
                                : "border-gray-200 dark:border-gray-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                              }
                            `}
                          >
                            {filter.label}
                            <ChevronDown className="ml-2 h-3 w-3 opacity-70" />
                            {isActive && (
                              <Badge 
                                variant="secondary" 
                                className="ml-2 h-4 min-w-4 px-1 bg-white/20 text-white border-0"
                              >
                                1
                              </Badge>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4" align="start">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 w-16 shrink-0">
                                最小值
                              </Label>
                              <Input
                                type="number"
                                value={minValue || ''}
                                onChange={(e) => onFilterChange(`${filter.field}_min`, e.target.value ? Number(e.target.value) : null)}
                                className="h-8 text-sm w-24"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 w-16 shrink-0">
                                最大值
                              </Label>
                              <Input
                                type="number"
                                value={maxValue || ''}
                                onChange={(e) => onFilterChange(`${filter.field}_max`, e.target.value ? Number(e.target.value) : null)}
                                className="h-8 text-sm w-24"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  onFilterChange(`${filter.field}_min`, null)
                                  onFilterChange(`${filter.field}_max`, null)
                                }}
                                className="h-7 text-xs"
                              >
                                清除
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )
                  }
                  
                  return null
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 活跃筛选标签显示区域 */}
      {mounted && hasAnyFilters && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {searchValue && (
            <Badge 
              variant="secondary" 
              className="px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg"
            >
              <Search className="h-3 w-3 mr-1.5" />
              搜索: {searchValue}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSearchChange('')}
                className="h-4 w-4 ml-2 -mr-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          
          {filterFields.map((filter) => {
            if (filter.type === 'select') {
              const value = filterValues[filter.field]
              if (!value || value === '__all__') return null
              
              // 如果是关系字段，优先从关系字段标签映射查找
              let label: string
              if (filter.relation) {
                label = relationFilterLabelsMap[filter.field]?.[String(value)] || value
              } else {
                // 普通 select 字段：优先从静态选项查找，然后从动态加载的选项映射查找
                const option = filter.options?.find(opt => opt.value === value)
                label = option?.label || filterOptionsMap[filter.field]?.[value] || value
              }
              
              return (
                <Badge
                  key={filter.field}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm font-medium bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border border-violet-200 dark:border-violet-800 rounded-lg shadow-sm"
                >
                  <Filter className="h-3 w-3 mr-1.5" />
                  {filter.label}: {label}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onFilterChange(filter.field, null)}
                    className="h-4 w-4 ml-2 -mr-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )
            }
            
            if (filter.type === 'dateRange') {
              const from = filterValues[`${filter.field}_from`]
              const to = filterValues[`${filter.field}_to`]
              if (!from && !to) return null
              return (
                <Badge
                  key={filter.field}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm font-medium bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border border-violet-200 dark:border-violet-800 rounded-lg shadow-sm"
                >
                  <Filter className="h-3 w-3 mr-1.5" />
                  {filter.label}: {from || '...'} 至 {to || '...'}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      onFilterChange(`${filter.field}_from`, null)
                      onFilterChange(`${filter.field}_to`, null)
                    }}
                    className="h-4 w-4 ml-2 -mr-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )
            }
            
            if (filter.type === 'numberRange') {
              const min = filterValues[`${filter.field}_min`]
              const max = filterValues[`${filter.field}_max`]
              if (!min && !max) return null
              return (
                <Badge
                  key={filter.field}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm font-medium bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border border-violet-200 dark:border-violet-800 rounded-lg shadow-sm"
                >
                  <Filter className="h-3 w-3 mr-1.5" />
                  {filter.label}: {min || '...'} 至 {max || '...'}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      onFilterChange(`${filter.field}_min`, null)
                      onFilterChange(`${filter.field}_max`, null)
                    }}
                    className="h-4 w-4 ml-2 -mr-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )
            }
            
            return null
          })}
          
          {hasActiveAdvancedSearch && (
            <Badge 
              variant="secondary" 
              className="px-3 py-1.5 text-sm font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700 rounded-lg shadow-sm"
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              高级搜索 ({activeAdvancedSearchCount} 个条件)
            </Badge>
          )}
        </div>
      )}

      {/* 高级搜索对话框 */}
      {stableAdvancedSearchFields.length > 0 && (
        <AdvancedSearchDialog
          key={advancedSearchKey}
          open={advancedSearchOpen}
          onOpenChange={onAdvancedSearchOpenChange}
          fields={stableAdvancedSearchFields}
          searchValues={advancedSearchValues}
          logic={advancedSearchLogic}
          onSearchChange={onAdvancedSearchChange}
          onLogicChange={onAdvancedSearchLogicChange}
          onSearch={onAdvancedSearch}
          onReset={onResetAdvancedSearch}
        />
      )}
    </div>
  )
}

// 子组件：Select 类型的筛选字段
interface SelectFilterFieldProps {
  filter: FilterFieldConfig
  currentValue: any
  onFilterChange: (field: string, value: any) => void
  mounted: boolean
  filterOptionsMap: Record<string, Record<string, string>>
  setFilterOptionsMap: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>
}

function SelectFilterField({
  filter,
  currentValue,
  onFilterChange,
  mounted,
  filterOptionsMap,
  setFilterOptionsMap,
}: SelectFilterFieldProps) {
  const isActive = currentValue && currentValue !== '__all__'
  
  // 动态加载选项的状态
  const [selectOptions, setSelectOptions] = React.useState<Array<{ label: string; value: string }>>(filter.options || [])
  const [loadingOptions, setLoadingOptions] = React.useState(false)
  const [optionsLoaded, setOptionsLoaded] = React.useState(!filter.loadOptions) // 如果有静态选项，则已经加载
  
  // 加载选项
  React.useEffect(() => {
    if (filter.loadOptions && !optionsLoaded && !loadingOptions) {
      setLoadingOptions(true)
      filter.loadOptions()
        .then((loadedOptions) => {
          setSelectOptions(loadedOptions)
          setOptionsLoaded(true)
          // 更新选项映射，用于显示标签
          const valueToLabelMap: Record<string, string> = {}
          loadedOptions.forEach((opt) => {
            valueToLabelMap[opt.value] = opt.label
          })
          setFilterOptionsMap((prev) => ({
            ...prev,
            [filter.field]: valueToLabelMap,
          }))
        })
        .catch((error) => {
          console.error(`加载筛选选项失败 (${filter.field}):`, error)
        })
        .finally(() => {
          setLoadingOptions(false)
        })
    } else if (filter.options && filter.options.length > 0) {
      // 静态选项，也更新映射
      const valueToLabelMap: Record<string, string> = {}
      filter.options.forEach((opt) => {
        valueToLabelMap[opt.value] = opt.label
      })
      setFilterOptionsMap((prev) => ({
        ...prev,
        [filter.field]: valueToLabelMap,
      }))
    }
  }, [filter.loadOptions, filter.options, filter.field, optionsLoaded, loadingOptions, setFilterOptionsMap])
  
  // 使用 DropdownMenu，Button 显示标签，点击后直接显示选项列表
  const selectedLabel = React.useMemo(() => {
    if (!currentValue || currentValue === '__all__') {
      return null
    }
    const option = filter.options?.find(opt => opt.value === currentValue)
    return option?.label || filterOptionsMap[filter.field]?.[currentValue] || currentValue
  }, [currentValue, filter.options, filter.field, filterOptionsMap])
  
  // 只在客户端挂载后渲染 DropdownMenu，避免 hydration 错误
  if (!mounted) {
    return (
      <Button
        variant="outline"
        className={`
          h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200
          ${isActive
            ? "border-indigo-200 dark:border-indigo-600 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 shadow-sm"
            : "border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
          }
        `}
        disabled
      >
        <span className="truncate">{filter.label}</span>
        <ChevronDown className="ml-2 h-3 w-3 opacity-70 shrink-0" />
      </Button>
    )
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`
            h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200
            ${isActive
              ? "border-indigo-200 dark:border-indigo-600 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 shadow-sm"
              : "border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
            }
          `}
          disabled={loadingOptions}
        >
          <span className="truncate">
            {loadingOptions ? "加载中..." : (selectedLabel || filter.label)}
          </span>
          <ChevronDown className="ml-2 h-3 w-3 opacity-70 shrink-0" />
          {isActive && (
            <Badge 
              variant="secondary" 
              className="ml-2 h-4 min-w-4 px-1 bg-white/20 text-white border-0 shrink-0"
            >
              1
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
        <DropdownMenuItem
          onClick={() => onFilterChange(filter.field, null)}
          className={!currentValue || currentValue === '__all__' ? "bg-accent" : ""}
        >
          全部
        </DropdownMenuItem>
        {selectOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onFilterChange(filter.field, option.value)}
            className={currentValue === option.value ? "bg-accent" : ""}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

