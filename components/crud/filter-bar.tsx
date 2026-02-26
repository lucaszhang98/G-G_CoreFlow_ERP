"use client"

/**
 * 筛选栏组件
 * 在搜索框旁边显示快速筛选器
 */

import * as React from "react"
import { X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { FilterFieldConfig } from "@/lib/crud/types"
import { cn } from "@/lib/utils"

interface FilterBarProps {
  filters: FilterFieldConfig[]
  filterValues: Record<string, any>
  onFilterChange: (field: string, value: any) => void
  onClearFilters: () => void
}

export function FilterBar({ filters, filterValues, onFilterChange, onClearFilters }: FilterBarProps) {
  if (!filters || filters.length === 0) return null

  // 计算已选筛选数量
  const activeFilterCount = Object.values(filterValues).filter(
    (v) => v !== null && v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true)
  ).length

  const hasActiveFilters = activeFilterCount > 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        if (filter.type === 'select' && filter.multiple) {
          // 多选：Popover + Checkbox
          const raw = filterValues[filter.field]
          const selectedArr: string[] = Array.isArray(raw)
            ? raw
            : typeof raw === 'string' && raw
              ? raw.split(',').map((s) => s.trim()).filter(Boolean)
              : []
          const displayText =
            selectedArr.length === 0
              ? filter.label
              : selectedArr.length === (filter.options?.length ?? 0)
                ? '全部'
                : `${filter.label} (${selectedArr.length})`
          return (
            <Popover key={filter.field}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 min-w-[100px] justify-between text-sm font-normal",
                    selectedArr.length > 0 && "border-primary/50 text-primary"
                  )}
                >
                  <span className="truncate">{displayText}</span>
                  <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-2" align="start">
                <div className="space-y-1.5">
                  {filter.options?.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 text-sm"
                    >
                      <Checkbox
                        checked={selectedArr.includes(option.value)}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...selectedArr, option.value]
                            : selectedArr.filter((v) => v !== option.value)
                          onFilterChange(filter.field, next.length > 0 ? next : null)
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                {selectedArr.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 h-8 text-xs"
                    onClick={() => onFilterChange(filter.field, null)}
                  >
                    清除
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          )
        }

        if (filter.type === 'select') {
          const currentValue = filterValues[filter.field]
          return (
            <Select
              key={filter.field}
              value={currentValue || undefined}
              onValueChange={(value) => {
                // 如果选择的是 "__all__"，则清除筛选
                if (value === '__all__') {
                  onFilterChange(filter.field, null)
                } else {
                  onFilterChange(filter.field, value)
                }
              }}
            >
              <SelectTrigger className="h-9 w-[140px] text-sm">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部</SelectItem>
                {filter.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }

        if (filter.type === 'dateRange') {
          return (
            <div key={filter.field} className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{filter.label}:</span>
              <Input
                type="date"
                value={filterValues[`${filter.field}_from`] || ''}
                onChange={(e) => onFilterChange(`${filter.field}_from`, e.target.value || null)}
                className="h-9 w-[140px] text-sm"
                placeholder="开始日期"
              />
              <span className="text-sm text-muted-foreground">-</span>
              <Input
                type="date"
                value={filterValues[`${filter.field}_to`] || ''}
                onChange={(e) => onFilterChange(`${filter.field}_to`, e.target.value || null)}
                className="h-9 w-[140px] text-sm"
                placeholder="结束日期"
              />
            </div>
          )
        }

        if (filter.type === 'numberRange') {
          return (
            <div key={filter.field} className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{filter.label}:</span>
              <Input
                type="number"
                value={filterValues[`${filter.field}_min`] || ''}
                onChange={(e) => onFilterChange(`${filter.field}_min`, e.target.value || null)}
                className="h-9 w-[120px] text-sm"
                placeholder="最小值"
              />
              <span className="text-sm text-muted-foreground">-</span>
              <Input
                type="number"
                value={filterValues[`${filter.field}_max`] || ''}
                onChange={(e) => onFilterChange(`${filter.field}_max`, e.target.value || null)}
                className="h-9 w-[120px] text-sm"
                placeholder="最大值"
              />
            </div>
          )
        }

        return null
      })}

      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="h-9 text-sm"
        >
          <X className="h-4 w-4 mr-1" />
          清除筛选 ({activeFilterCount})
        </Button>
      )}
    </div>
  )
}

