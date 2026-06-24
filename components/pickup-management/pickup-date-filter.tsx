"use client"

import * as React from "react"
import { CalendarRange, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getPickupDateFilterFieldOptions,
  PICKUP_DATE_FILTER_PARAM_FIELD,
  PICKUP_DATE_FILTER_PARAM_FROM,
  PICKUP_DATE_FILTER_PARAM_TO,
} from "@/lib/tms/pickup-management-unified-date-filter"

type PickupDateFilterProps = {
  filterValues: Record<string, unknown>
  onFilterChange: (field: string, value: unknown) => void
}

export function PickupDateFilter({
  filterValues,
  onFilterChange,
}: PickupDateFilterProps) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const fieldOptions = React.useMemo(() => getPickupDateFilterFieldOptions(), [])

  const selectedField = String(filterValues[PICKUP_DATE_FILTER_PARAM_FIELD] ?? "")
  const fromValue = String(filterValues[PICKUP_DATE_FILTER_PARAM_FROM] ?? "")
  const toValue = String(filterValues[PICKUP_DATE_FILTER_PARAM_TO] ?? "")
  const isActive = Boolean(selectedField && (fromValue || toValue))

  const handleFieldChange = (value: string) => {
    onFilterChange(PICKUP_DATE_FILTER_PARAM_FIELD, value || null)
  }

  const handleClear = () => {
    onFilterChange(PICKUP_DATE_FILTER_PARAM_FIELD, null)
    onFilterChange(PICKUP_DATE_FILTER_PARAM_FROM, null)
    onFilterChange(PICKUP_DATE_FILTER_PARAM_TO, null)
  }

  if (!mounted) {
    return (
      <Button variant="outline" className="h-9 px-4 rounded-lg text-sm font-medium" disabled>
        日期筛选
        <ChevronDown className="ml-2 h-3 w-3 opacity-70" />
      </Button>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`
            h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200 shrink-0
            ${isActive
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md shadow-cyan-500/20"
              : "border-gray-200 dark:border-gray-800 hover:border-cyan-400 dark:hover:border-cyan-600 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20"
            }
          `}
        >
          <CalendarRange className="mr-1.5 h-4 w-4 shrink-0" />
          日期筛选
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
      <PopoverContent className="w-auto min-w-[320px] p-4" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium text-gray-600 dark:text-gray-400 w-16 shrink-0">
              日期字段
            </Label>
            <Select
              value={selectedField || undefined}
              onValueChange={handleFieldChange}
            >
              <SelectTrigger className="h-9 text-base flex-1">
                <SelectValue placeholder="选择要筛选的日期" />
              </SelectTrigger>
              <SelectContent>
                {fieldOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium text-gray-600 dark:text-gray-400 w-16 shrink-0">
              开始时间
            </Label>
            <Input
              type="date"
              value={fromValue}
              disabled={!selectedField}
              onChange={(e) =>
                onFilterChange(PICKUP_DATE_FILTER_PARAM_FROM, e.target.value || null)
              }
              className="h-9 text-base flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium text-gray-600 dark:text-gray-400 w-16 shrink-0">
              结束时间
            </Label>
            <Input
              type="date"
              value={toValue}
              disabled={!selectedField}
              onChange={(e) =>
                onFilterChange(PICKUP_DATE_FILTER_PARAM_TO, e.target.value || null)
              }
              className="h-9 text-base flex-1"
            />
          </div>
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full text-base"
              onClick={handleClear}
            >
              清除日期筛选
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
