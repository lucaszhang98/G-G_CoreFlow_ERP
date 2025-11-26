"use client"

import * as React from "react"
import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface ClickableCellProps {
  /** 显示的内容 */
  children: React.ReactNode
  /** 点击回调函数 */
  onClick?: () => void
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义类名 */
  className?: string
  /** Tooltip 提示文本 */
  title?: string
  /** 是否显示外部链接图标 */
  showIcon?: boolean
  /** 是否加粗显示 */
  bold?: boolean
}

/**
 * 可点击的单元格组件
 * 用于表格中的可点击链接，具有统一的 hover 效果和样式
 */
export function ClickableCell({
  children,
  onClick,
  disabled = false,
  className,
  title,
  showIcon = true,
  bold = false,
}: ClickableCellProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!disabled && onClick) {
      onClick()
    }
  }

  const isClickable = !disabled && !!onClick

  return (
    <button
      onClick={handleClick}
      disabled={disabled || !onClick}
      className={cn(
        "group inline-flex items-center gap-1.5",
        "font-medium transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
        "rounded px-1.5 py-0.5 -mx-1.5 -my-0.5",
        isClickable
          ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer active:scale-[0.98]"
          : "text-gray-400 cursor-not-allowed opacity-60",
        bold && "font-semibold",
        className
      )}
      title={title}
    >
      <span>{children}</span>
      {isClickable && showIcon && (
        <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      )}
    </button>
  )
}

