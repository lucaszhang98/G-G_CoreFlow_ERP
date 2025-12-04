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
import { cn } from "@/lib/utils"
import { formatDateDisplay, formatDateTimeDisplay } from "@/lib/utils/date-format"

interface EditableCellProps {
  value: string | number | Date | null | undefined
  onSave: (value: string | null) => Promise<void> | void
  type?: "text" | "number" | "date" | "datetime-local" | "select"
  className?: string
  disabled?: boolean
  placeholder?: string
  // 下拉选择选项
  options?: Array<{ label: string; value: string }>
  // 选项加载函数（用于异步加载选项）
  loadOptions?: () => Promise<Array<{ label: string; value: string }>>
}

export function EditableCell({
  value,
  onSave,
  type = "text",
  className,
  disabled = false,
  placeholder: _placeholder = "点击编辑",
  options = [],
  loadOptions,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editValue, setEditValue] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const [selectOptions, setSelectOptions] = React.useState<Array<{ label: string; value: string }>>(options)
  const [loadingOptions, setLoadingOptions] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 初始化编辑值
  React.useEffect(() => {
    if (isEditing) {
      if (type === "date" && value) {
        // 处理 Date 对象、字符串或数字
        // 使用 UTC 方法提取日期部分，避免时区转换问题
        if (typeof value === 'string') {
          // 如果是字符串，直接提取日期部分（YYYY-MM-DD）
          const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/)
          if (dateMatch) {
            setEditValue(dateMatch[1])
            return
          }
        }
        
        const date = (value instanceof Date) ? value : new Date(value as string | number)
        if (!isNaN(date.getTime())) {
          // 使用 UTC 方法提取日期，避免时区转换
          const year = date.getUTCFullYear()
          const month = String(date.getUTCMonth() + 1).padStart(2, "0")
          const day = String(date.getUTCDate()).padStart(2, "0")
          setEditValue(`${year}-${month}-${day}`)
        } else {
          setEditValue("")
        }
      } else if (type === "datetime-local" && value) {
        // 处理 datetime-local 类型
        let date: Date
        if (value instanceof Date) {
          date = value
        } else if (typeof value === 'string') {
          // 如果已经是 datetime-local 格式 (YYYY-MM-DDTHH:mm)，直接使用
          if (value.includes('T')) {
            setEditValue(value)
            return
          }
          // 否则尝试解析为日期
          date = new Date(value)
        } else {
          date = new Date(value)
        }
        
        if (!isNaN(date.getTime())) {
          // 转换为本地日期时间格式 (YYYY-MM-DDTHH:mm)
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, "0")
          const day = String(date.getDate()).padStart(2, "0")
          const hours = String(date.getHours()).padStart(2, "0")
          const minutes = String(date.getMinutes()).padStart(2, "0")
          setEditValue(`${year}-${month}-${day}T${hours}:${minutes}`)
        } else {
          setEditValue("")
        }
      } else {
        setEditValue(value?.toString() || "")
      }
    }
  }, [isEditing, value, type])

  // 进入编辑模式时聚焦输入框
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // 加载选项（如果是异步加载）
  React.useEffect(() => {
    if (type === "select" && loadOptions && selectOptions.length === 0 && !loadingOptions) {
      setLoadingOptions(true)
      loadOptions()
        .then((loadedOptions) => {
          setSelectOptions(loadedOptions)
        })
        .catch((error) => {
          console.error("加载选项失败:", error)
        })
        .finally(() => {
          setLoadingOptions(false)
        })
    }
  }, [type, loadOptions, selectOptions.length, loadingOptions])

  // 同步 options prop 变化
  React.useEffect(() => {
    if (options.length > 0) {
      setSelectOptions(options)
    }
  }, [options])

  const handleClick = () => {
    if (!disabled && !isEditing) {
      setIsEditing(true)
      // 如果是select类型且需要异步加载，触发加载
      if (type === "select" && loadOptions && selectOptions.length === 0) {
        setLoadingOptions(true)
        loadOptions()
          .then((loadedOptions) => {
            setSelectOptions(loadedOptions)
          })
          .catch((error) => {
            console.error("加载选项失败:", error)
          })
          .finally(() => {
            setLoadingOptions(false)
          })
      }
    }
  }

  const handleSave = async () => {
    if (isSaving) return

    try {
      setIsSaving(true)
      
      // 对于 datetime-local 类型，确保格式正确
      let valueToSave: string | null = editValue
      if (type === "datetime-local" && editValue) {
        // datetime-local 格式已经是 YYYY-MM-DDTHH:mm，直接使用
        // 如果为空，传递 null
        valueToSave = editValue.trim() || null
      } else if (type === "date" && editValue) {
        // date 格式是 YYYY-MM-DD，直接使用
        valueToSave = editValue.trim() || null
      } else if (editValue) {
        valueToSave = editValue.trim() || null
      } else {
        valueToSave = null
      }
      
      await onSave(valueToSave)
      setIsEditing(false)
    } catch (error) {
      console.error("保存失败:", error)
      // 保存失败时保持编辑状态，让用户重试
      throw error // 重新抛出错误，让调用者知道保存失败
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value?.toString() || "")
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleBlur = () => {
    // 延迟处理，以便点击保存按钮时不会立即触发
    setTimeout(() => {
      if (isEditing && !isSaving) {
        handleSave()
      }
    }, 200)
  }

  if (isEditing) {
    // Select 类型使用下拉框
    if (type === "select") {
      return (
        <Select
          value={editValue || undefined}
          onValueChange={(val) => {
            setEditValue(val)
            // Select 类型保存后立即关闭编辑模式
            const saveResult = onSave(val || null)
            if (saveResult instanceof Promise) {
              saveResult
                .then(() => {
                  setIsEditing(false)
                })
                .catch((error: any) => {
                  console.error("保存失败:", error)
                  // 保存失败时保持编辑状态
                })
            } else {
              // 如果 onSave 返回 void，直接关闭编辑模式
              setIsEditing(false)
            }
          }}
          onOpenChange={(open) => {
            // 当选择框关闭时，如果没有选择任何值，取消编辑
            if (!open && !editValue && !isSaving) {
              setIsEditing(false)
            }
          }}
          disabled={isSaving || loadingOptions}
        >
          <SelectTrigger
            className={cn("h-8 min-w-[150px] px-2", className)}
            onClick={(e) => e.stopPropagation()}
          >
            <SelectValue placeholder={loadingOptions ? "加载中..." : "请选择"} />
          </SelectTrigger>
          <SelectContent onClick={(e) => e.stopPropagation()}>
            <SelectItem value="">（无）</SelectItem>
            {selectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    // 其他类型使用 Input
    return (
      <Input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={isSaving}
        className={cn("h-8 min-w-[100px] px-2", className)}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  // 格式化显示值（显示时不包含年份，节省空间）
  const getDisplayValue = () => {
    if (!value) return "-"
    
    // Select 类型：显示选项的 label
    if (type === "select") {
      const option = selectOptions.find((opt) => opt.value === String(value))
      return option ? option.label : value.toString()
    }
    
    if (type === "datetime-local") {
      // 使用统一的格式化函数，显示为 MM-DD HH:mm（不包含年份和秒）
      return formatDateTimeDisplay(value as Date | string | null | undefined)
    } else if (type === "date") {
      // 使用统一的格式化函数，显示为 MM-DD（不包含年份）
      return formatDateDisplay(value as Date | string | null | undefined)
    }
    
    return value.toString()
  }

  const displayValue = getDisplayValue()

  return (
    <div
      onClick={handleClick}
      className={cn(
        "min-h-[32px] px-2 py-1 rounded cursor-pointer hover:bg-muted/50 transition-colors flex items-center",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      title={disabled ? undefined : "点击编辑"}
    >
      <span className={cn(displayValue === "-" && "text-muted-foreground")}>
        {displayValue}
      </span>
    </div>
  )
}

