"use client"

/**
 * 高级搜索对话框组件
 * 支持多条件组合，AND/OR 逻辑
 */

import * as React from "react"
import { Search, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AdvancedSearchFieldConfig } from "@/lib/crud/types"
import { loadRelationOptions } from "@/lib/crud/relation-loader"
import { Loader2 } from "lucide-react"

interface AdvancedSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: AdvancedSearchFieldConfig[]
  searchValues: Record<string, any>
  logic: 'AND' | 'OR'
  onSearchChange: (field: string, value: any) => void
  onLogicChange: (logic: 'AND' | 'OR') => void
  onSearch: () => void
  onReset: () => void
}

export function AdvancedSearchDialog({
  open,
  onOpenChange,
  fields,
  searchValues,
  logic,
  onSearchChange,
  onLogicChange,
  onSearch,
  onReset,
}: AdvancedSearchDialogProps) {
  if (!fields || fields.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl bg-white dark:bg-gray-900">
        <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-800">
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
              <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            高级搜索
          </DialogTitle>
          <DialogDescription className="text-base text-gray-600 dark:text-gray-400 mt-2">
            组合多个条件进行精确搜索，支持 AND/OR 逻辑关系
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* 逻辑选择 */}
          <div className="bg-gradient-to-r from-blue-50/50 via-indigo-50/50 to-purple-50/50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">逻辑关系：</Label>
              <RadioGroup
                value={logic}
                onValueChange={(value) => onLogicChange(value as 'AND' | 'OR')}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2.5 group">
                  <RadioGroupItem value="AND" id="logic-and" className="border-2 border-gray-300 dark:border-gray-700 group-hover:border-blue-500 dark:group-hover:border-blue-400" />
                  <Label htmlFor="logic-and" className="text-sm font-medium cursor-pointer text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    AND（所有条件都满足）
                  </Label>
                </div>
                <div className="flex items-center space-x-2.5 group">
                  <RadioGroupItem value="OR" id="logic-or" className="border-2 border-gray-300 dark:border-gray-700 group-hover:border-purple-500 dark:group-hover:border-purple-400" />
                  <Label htmlFor="logic-or" className="text-sm font-medium cursor-pointer text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    OR（任一条件满足）
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* 搜索字段 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-700"></div>
              <span>搜索条件</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-700"></div>
            </div>
            {fields.map((field) => {
              if (field.type === 'text' || field.type === 'number') {
                return (
                  <div key={field.field} className="space-y-2 group">
                    <Label htmlFor={field.field} className="text-sm font-medium text-gray-700 dark:text-gray-300 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors">
                      {field.label}
                    </Label>
                    <Input
                      id={field.field}
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={searchValues[field.field] || ''}
                      onChange={(e) => onSearchChange(field.field, e.target.value || null)}
                      placeholder={`请输入${field.label}`}
                      className="h-10 border-2 border-gray-200 dark:border-gray-800 focus:border-blue-500 dark:focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>
                )
              }

              if (field.type === 'date' || field.type === 'datetime') {
                return (
                  <div key={field.field} className="space-y-2 group">
                    <Label htmlFor={field.field} className="text-sm font-medium text-gray-700 dark:text-gray-300 group-focus-within:text-cyan-600 dark:group-focus-within:text-cyan-400 transition-colors">
                      {field.label}
                    </Label>
                    <Input
                      id={field.field}
                      type={field.type === 'datetime' ? 'datetime-local' : 'date'}
                      value={searchValues[field.field] || ''}
                      onChange={(e) => onSearchChange(field.field, e.target.value || null)}
                      className="h-10 border-2 border-gray-200 dark:border-gray-800 focus:border-cyan-500 dark:focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 dark:focus:ring-cyan-500/20 transition-all duration-200"
                    />
                  </div>
                )
              }

              if (field.type === 'select') {
                const currentValue = searchValues[field.field]
                // 关系字段需要动态加载选项
                const [relationOptions, setRelationOptions] = React.useState<Array<{ label: string; value: string }>>([])
                const [loadingRelation, setLoadingRelation] = React.useState(false)
                const [relationOptionsLoaded, setRelationOptionsLoaded] = React.useState(false)

                // 加载关系字段选项
                React.useEffect(() => {
                  if (field.relation && !relationOptionsLoaded && !loadingRelation) {
                    setLoadingRelation(true)
                    loadRelationOptions(field)
                      .then((options) => {
                        setRelationOptions(options)
                        setRelationOptionsLoaded(true)
                      })
                      .catch((error) => {
                        console.error(`加载${field.label}选项失败:`, error)
                      })
                      .finally(() => {
                        setLoadingRelation(false)
                      })
                  }
                }, [field, relationOptionsLoaded, loadingRelation])

                // 使用静态选项或动态加载的选项
                const selectOptions = field.options || relationOptions

                return (
                  <div key={field.field} className="space-y-2 group">
                    <Label htmlFor={field.field} className="text-sm font-medium text-gray-700 dark:text-gray-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors">
                      {field.label}
                    </Label>
                    <Select
                      value={currentValue || undefined}
                      onValueChange={(value) => {
                        // 如果选择的是 "__all__"，则清除条件
                        if (value === '__all__') {
                          onSearchChange(field.field, null)
                        } else {
                          onSearchChange(field.field, value)
                        }
                      }}
                      disabled={loadingRelation}
                    >
                      <SelectTrigger id={field.field} className="h-10 border-2 border-gray-200 dark:border-gray-800 focus:border-indigo-500 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/20 transition-all duration-200">
                        <SelectValue placeholder={loadingRelation ? '加载中...' : `请选择${field.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">全部</SelectItem>
                        {loadingRelation ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          </div>
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

              if (field.type === 'dateRange') {
                return (
                  <div key={field.field} className="space-y-2 md:col-span-2 group">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 group-focus-within:text-cyan-600 dark:group-focus-within:text-cyan-400 transition-colors">{field.label}</Label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 space-y-2">
                        <Label className="text-xs text-gray-500">开始日期</Label>
                        <Input
                          type="date"
                          value={searchValues[`${field.field}_from`] || ''}
                          onChange={(e) => onSearchChange(`${field.field}_from`, e.target.value || null)}
                          className="h-10 border-2 border-gray-200 dark:border-gray-800 focus:border-cyan-500 dark:focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 dark:focus:ring-cyan-500/20 transition-all duration-200"
                        />
                      </div>
                      <div className="pt-6 text-gray-400 dark:text-gray-600">至</div>
                      <div className="flex-1 space-y-2">
                        <Label className="text-xs text-gray-500">结束日期</Label>
                        <Input
                          type="date"
                          value={searchValues[`${field.field}_to`] || ''}
                          onChange={(e) => onSearchChange(`${field.field}_to`, e.target.value || null)}
                          className="h-10 border-2 border-gray-200 dark:border-gray-800 focus:border-cyan-500 dark:focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 dark:focus:ring-cyan-500/20 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                )
              }

              if (field.type === 'numberRange') {
                return (
                  <div key={field.field} className="space-y-2 md:col-span-2 group">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400 transition-colors">{field.label}</Label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 space-y-2">
                        <Label className="text-xs text-gray-500">最小值</Label>
                        <Input
                          type="number"
                          value={searchValues[`${field.field}_min`] || ''}
                          onChange={(e) => onSearchChange(`${field.field}_min`, e.target.value || null)}
                          placeholder="最小值"
                          className="h-10 border-2 border-gray-200 dark:border-gray-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 dark:focus:ring-emerald-500/20 transition-all duration-200"
                        />
                      </div>
                      <div className="pt-6 text-gray-400 dark:text-gray-600">至</div>
                      <div className="flex-1 space-y-2">
                        <Label className="text-xs text-gray-500">最大值</Label>
                        <Input
                          type="number"
                          value={searchValues[`${field.field}_max`] || ''}
                          onChange={(e) => onSearchChange(`${field.field}_max`, e.target.value || null)}
                          placeholder="最大值"
                          className="h-10 border-2 border-gray-200 dark:border-gray-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 dark:focus:ring-emerald-500/20 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                )
              }

              return null
            })}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-gray-200 dark:border-gray-800 gap-3">
          <Button 
            variant="outline" 
            onClick={onReset}
            className="h-11 px-6 rounded-xl border-2 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all duration-200"
          >
            <X className="h-4 w-4 mr-2" />
            重置
          </Button>
          <Button 
            onClick={onSearch}
            className="h-11 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200 font-medium"
          >
            <Search className="h-4 w-4 mr-2" />
            执行搜索
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

