"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface EditableCellProps {
  value: string | number | null | undefined
  onSave: (value: string | null) => Promise<void> | void
  type?: "text" | "number" | "date" | "datetime-local"
  className?: string
  disabled?: boolean
  placeholder?: string
}

export function EditableCell({
  value,
  onSave,
  type = "text",
  className,
  disabled = false,
  placeholder: _placeholder = "点击编辑",
}: EditableCellProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editValue, setEditValue] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 初始化编辑值
  React.useEffect(() => {
    if (isEditing) {
      if (type === "date" && value) {
        const date = new Date(value as string)
        if (!isNaN(date.getTime())) {
          setEditValue(date.toISOString().split("T")[0])
        } else {
          setEditValue("")
        }
      } else if (type === "datetime-local" && value) {
        // 处理 datetime-local 类型
        let date: Date
        if (typeof value === 'string') {
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

  const handleClick = () => {
    if (!disabled && !isEditing) {
      setIsEditing(true)
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

  // 格式化显示值
  const getDisplayValue = () => {
    if (!value) return "-"
    
    if (type === "datetime-local") {
      // 如果是 datetime-local 类型，格式化显示
      const date = new Date(value as string)
      if (isNaN(date.getTime())) return value.toString()
      
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      const hours = String(date.getHours()).padStart(2, "0")
      const minutes = String(date.getMinutes()).padStart(2, "0")
      return `${year}-${month}-${day} ${hours}:${minutes}`
    } else if (type === "date") {
      // 如果是 date 类型，格式化显示
      // 如果已经是 YYYY-MM-DD 格式的字符串，直接返回
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value
      }
      // 如果是 ISO 字符串格式，提取日期部分
      if (typeof value === 'string' && value.includes('T')) {
        return value.split('T')[0]
      }
      // 否则解析为 Date 对象
      const date = new Date(value as string)
      if (isNaN(date.getTime())) return value.toString()
      
      // 使用与初始化编辑值时相同的逻辑：toISOString().split("T")[0]
      // 这样显示和编辑使用完全相同的格式
      return date.toISOString().split("T")[0]
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

