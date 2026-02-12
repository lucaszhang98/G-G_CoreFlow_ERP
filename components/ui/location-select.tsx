/**
 * 位置选择组件
 * 支持两级下拉框：位置类型 -> 位置代码（支持模糊搜索）
 */

"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search, MapPin, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface Location {
  location_id: string | number
  location_code: string | null
  name: string
  location_type: string
}

interface LocationSelectProps {
  value?: string | number | null
  onChange?: (value: string | number | null) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
  locationType?: string // 直接指定位置类型，如果提供则只显示该类型的位置，不显示类型选择器
}

const LOCATION_TYPES = [
  { label: '码头', value: 'port' },
  { label: '亚马逊', value: 'amazon' },
  { label: '仓库', value: 'warehouse' },
]

export function LocationSelect({
  value,
  onChange,
  onBlur,
  placeholder = "选择位置...",
  className,
  disabled = false,
  locationType, // 直接指定位置类型
}: LocationSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedType, setSelectedType] = React.useState<string | null>(locationType || null)
  const [locations, setLocations] = React.useState<Location[]>([])
  const [loading, setLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  
  // 如果指定了 locationType，自动设置为选中类型
  React.useEffect(() => {
    if (locationType && !selectedType) {
      setSelectedType(locationType)
    }
  }, [locationType, selectedType])

  // 获取选中的位置信息
  // 支持通过location_id或location_code查找
  const selectedLocation = React.useMemo(() => {
    if (!value) return null
    // 先尝试通过location_id查找
    let found = locations.find((loc) => String(loc.location_id) === String(value))
    if (!found) {
      // 如果没找到，尝试通过location_code查找（value可能是location_code字符串）
      found = locations.find((loc) => loc.location_code === value)
    }
    return found
  }, [value, locations])

  // 根据类型加载位置列表（支持搜索）
  const loadLocations = React.useCallback(async (type: string, search?: string): Promise<Location[]> => {
    if (!type) {
      setLocations([])
      return []
    }

    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('type', type)
      if (search && search.trim()) {
        params.set('search', search.trim())
      }
      
      const response = await fetch(`/api/locations/by-type?${params.toString()}`)
      if (!response.ok) {
        throw new Error('获取位置列表失败')
      }
      const data = await response.json()
      const locations = data.data || []
      setLocations(locations)
      return locations
    } catch (error) {
      console.error('加载位置列表失败:', error)
      setLocations([])
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // 当选择类型改变或搜索词改变时，加载对应的位置列表
  React.useEffect(() => {
    const typeToUse = locationType || selectedType
    if (typeToUse) {
      loadLocations(typeToUse, searchQuery)
    } else {
      setLocations([])
    }
  }, [locationType, selectedType, searchQuery, loadLocations])

  // 初始化：如果有值，先加载对应的位置信息来确定类型
  // 如果指定了 locationType，直接加载该类型的位置
  React.useEffect(() => {
    if (locationType && selectedType !== locationType) {
      setSelectedType(locationType)
    }
  }, [locationType, selectedType])
  
  // 当指定了 locationType 且有 value 时，确保加载位置列表以便查找
  React.useEffect(() => {
    if (locationType && value && locations.length === 0 && !loading) {
      loadLocations(locationType)
    }
  }, [locationType, value, locations.length, loading, loadLocations])
  
  React.useEffect(() => {
    if (value && !selectedLocation && !selectedType && !locationType) {
      // 先加载所有类型的位置来查找当前值
      const loadCurrentLocation = async () => {
        try {
          // 检查value是否是数字（location_id）还是字符串（可能是location_code）
          const isNumeric = !isNaN(Number(value)) && !isNaN(parseFloat(String(value)))
          
          if (isNumeric) {
            // value是location_id，直接查询（API 可能返回 { data: {...} }）
            const response = await fetch(`/api/locations/${value}`)
            if (response.ok) {
              const raw = await response.json()
              const location = raw?.data ?? raw
              if (location && location.location_type) {
                setSelectedType(location.location_type)
                await loadLocations(location.location_type)
              }
            }
          } else {
            // value可能是location_code，需要通过code查找
            // 尝试通过所有类型查找
            for (const type of LOCATION_TYPES) {
              const locations = await loadLocations(type.value)
              const found = locations.find((loc: Location) => loc.location_code === value)
              if (found) {
                setSelectedType(type.value)
                // 重新加载以确保locations state更新
                await loadLocations(type.value)
                break
              }
            }
          }
        } catch (error) {
          console.error('加载当前位置失败:', error)
        }
      }
      loadCurrentLocation()
    }
  }, [value, selectedLocation, selectedType, locationType, loadLocations])
  
  // 当locations加载完成后，再次检查selectedLocation
  React.useEffect(() => {
    if (value && locations.length > 0 && !selectedLocation) {
      const found = locations.find((loc) => String(loc.location_id) === String(value))
      if (found) {
        // 位置已找到，不需要额外操作，selectedLocation会在下次渲染时更新
      }
    }
  }, [value, locations, selectedLocation])

  // 位置列表已经在后端根据搜索词过滤了，这里直接使用
  const filteredLocations = React.useMemo(() => {
    return locations
  }, [locations])

  const handleSelect = React.useCallback((locationId: string | number) => {
    // 确保传递的是location_id（数字），而不是location_code（字符串）
    const id = typeof locationId === 'string' && !isNaN(Number(locationId)) 
      ? Number(locationId) 
      : locationId
    onChange?.(id)
    setOpen(false)
    setSearchQuery("")
  }, [onChange])

  // 只显示位置代码
  const displayValue = selectedLocation
    ? (selectedLocation.location_code || '无代码')
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            // 基础样式 - 统一白色样式，所有位置选择字段都使用这个
            "w-full justify-between h-10 min-w-[120px] font-medium transition-all duration-200",
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
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-muted/50 text-muted-foreground flex-shrink-0">
              <MapPin className="h-3 w-3" />
            </span>
            <span className="font-medium truncate text-muted-foreground">
              {displayValue}
            </span>
          </span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value && (
              <span
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange?.(null)
                }}
                className={cn(
                  "inline-flex items-center justify-center w-4 h-4 rounded-full cursor-pointer",
                  "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50",
                  "transition-colors"
                )}
                title="清空"
                role="button"
                tabIndex={-1}
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className={cn(
              "h-4 w-4 shrink-0 transition-all duration-200 text-muted-foreground/60",
              open && "rotate-180"
            )} />
          </div>
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
                选择位置类型
              </span>
            </div>
            {!locationType && (
              <div className="flex gap-2.5">
                {LOCATION_TYPES.map((type) => (
                  <Button
                    key={type.value}
                    variant={selectedType === type.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedType(selectedType === type.value ? null : type.value)
                      setSearchQuery("")
                    }}
                    className={cn(
                      "text-xs font-semibold transition-all duration-200",
                      selectedType === type.value 
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 border-0" 
                        : "border-border/50 hover:border-blue-400/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-blue-300"
                    )}
                  >
                    {type.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          
          {selectedType && (
            <>
              <div className="border-b bg-background/50 backdrop-blur-sm">
                <div className="flex items-center px-4 py-3">
                  <div className="p-1.5 rounded-md bg-muted/50 mr-2.5">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                  <input
                    type="text"
                    placeholder="搜索位置代码..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex h-9 w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:placeholder:text-muted-foreground/40 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
              <CommandList className="max-h-[280px] overflow-y-auto overflow-x-hidden">
                {loading ? (
                  <div className="py-8 text-center">
                    <div className="inline-flex items-center gap-2.5 text-sm text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                      <span>加载中...</span>
                    </div>
                  </div>
                ) : filteredLocations.length === 0 && searchQuery ? (
                  <div className="py-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                      <Search className="h-5 w-5 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">未找到匹配的位置代码</p>
                    <p className="text-xs text-muted-foreground">请尝试其他搜索关键词</p>
                  </div>
                ) : null}
                <CommandGroup>
                  {filteredLocations.map((location) => {
                    const isSelected = String(value) === String(location.location_id)
                    return (
                      <div
                        key={location.location_id}
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
                          handleSelect(location.location_id)
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleSelect(location.location_id)
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
                        <div className="flex items-center justify-between w-full min-w-0">
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className={cn(
                              "font-semibold text-sm truncate",
                              isSelected ? "text-blue-700 dark:text-blue-300" : "text-foreground"
                            )}>
                              {location.location_code || '无代码'}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {location.name}
                            </span>
                          </div>
                          <span className={cn(
                            "text-xs px-2.5 py-1 rounded-full ml-2 flex-shrink-0",
                            isSelected 
                              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium"
                              : "bg-muted/60 text-muted-foreground"
                          )}>
                            {LOCATION_TYPES.find(t => t.value === location.location_type)?.label || location.location_type}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </>
          )}
          
          {!selectedType && !locationType && (
            <div className="p-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-950/40 mb-4 shadow-sm">
                <MapPin className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1.5">请先选择位置类型</p>
              <p className="text-xs text-muted-foreground">选择上方的位置类型以查看可用位置</p>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

