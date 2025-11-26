"use client"

/**
 * 筛选栏组件
 * 在搜索框旁边显示快速筛选器
 */

import * as React from "react"
import { X, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { FilterFieldConfig } from "@/lib/crud/types"

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

