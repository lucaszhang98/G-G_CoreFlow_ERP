/**
 * 带清空功能的 Select 组件包装器
 * 框架级通用组件，可以在所有 Select 组件上自动添加清空功能
 */

"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const CLEAR_VALUE = "__clear__"

// 使用 SelectPrimitive.Root 的 props 类型
type SelectProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>

interface SelectWithClearProps extends Omit<SelectProps, 'value' | 'onValueChange'> {
  value?: string | number | null
  onValueChange?: (value: string | null) => void
  children: React.ReactNode
  allowClear?: boolean // 是否允许清空，默认为 true（当有值时自动显示清空选项）
  clearLabel?: string // 清空选项的标签，默认为 "（清空）"
  className?: string
  disabled?: boolean // 是否禁用
}

/**
 * 带清空功能的 Select 组件
 * 
 * @example
 * ```tsx
 * <SelectWithClear
 *   value={selectedValue}
 *   onValueChange={(val) => setSelectedValue(val)}
 *   allowClear={true}
 * >
 *   <SelectTrigger>
 *     <SelectValue placeholder="请选择..." />
 *   </SelectTrigger>
 *   <SelectContent>
 *     {options.map(option => (
 *       <SelectItem key={option.value} value={option.value}>
 *         {option.label}
 *       </SelectItem>
 *     ))}
 *   </SelectContent>
 * </SelectWithClear>
 * ```
 */
export function SelectWithClear({
  value,
  onValueChange,
  children,
  allowClear = true,
  clearLabel = "（清空）",
  className,
  ...props
}: SelectWithClearProps) {
  const hasValue = value !== null && value !== undefined && value !== ""

  // 处理值变化
  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (newValue === CLEAR_VALUE) {
        // 清空选择
        onValueChange?.(null)
      } else {
        // 正常选择
        onValueChange?.(newValue || null)
      }
    },
    [onValueChange]
  )

  // 克隆 children 并注入清空选项
  const enhancedChildren = React.useMemo(() => {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        // 检查是否是 SelectContent（通过 displayName 或类型名称）
        const childType = child.type as any
        const isSelectContent = 
          childType?.displayName === 'SelectContent' ||
          childType?.name === 'SelectContent' ||
          (childType?.$$typeof && String(childType).includes('SelectContent'))
        
        if (isSelectContent) {
          const childElement = child as React.ReactElement<{ children?: React.ReactNode }>
          const contentChildren = React.Children.toArray(childElement.props.children)
          const clearOption =
            allowClear && hasValue ? (
              <SelectItem key={CLEAR_VALUE} value={CLEAR_VALUE}>
                <span className="text-muted-foreground italic">{clearLabel}</span>
              </SelectItem>
            ) : null

          return React.cloneElement(
            childElement,
            {},
            clearOption ? [clearOption, ...contentChildren] : contentChildren
          )
        }
      }
      return child
    })
  }, [children, allowClear, hasValue, clearLabel])

  return (
    <Select
      value={value != null ? String(value) : ""}
      onValueChange={handleValueChange}
      {...props}
    >
      {enhancedChildren}
    </Select>
  )
}

