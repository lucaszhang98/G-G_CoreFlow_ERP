/**
 * Badge 组件工具函数
 */

import React from "react"
import { Badge } from "@/components/ui/badge"

/**
 * 订单状态映射（与 orderConfig 中的 status options 保持一致）
 */
export const ORDER_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: '待处理', variant: 'secondary' },
  confirmed: { label: '已确认', variant: 'default' },
  shipped: { label: '已发货', variant: 'default' },
  delivered: { label: '已交付', variant: 'default' },
  cancelled: { label: '已取消', variant: 'destructive' },
  archived: { label: '完成留档', variant: 'outline' }, // 软删除状态
}

/**
 * 获取状态 Badge（通用，支持订单和其他实体）
 */
export function getStatusBadge(status: string | null | undefined): React.ReactElement {
  if (!status) return <Badge variant="secondary">-</Badge>
  
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    // 订单状态（与 ORDER_STATUS_MAP 保持一致）
    ...ORDER_STATUS_MAP,
    // 其他通用状态
    transit: { label: '运输中', variant: 'default' },
    canceled: { label: '已取消', variant: 'destructive' }, // 兼容拼写
    rejected: { label: '已拒绝', variant: 'destructive' },
    active: { label: '激活', variant: 'default' },
    inactive: { label: '停用', variant: 'secondary' },
  }
  
  const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const }
  return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
}

/**
 * 获取订单状态 Badge（专门用于订单，确保与配置一致）
 */
export function getOrderStatusBadge(status: string | null | undefined): React.ReactElement {
  if (!status) return <Badge variant="secondary">-</Badge>
  
  const statusInfo = ORDER_STATUS_MAP[status] || { label: status, variant: 'outline' as const }
  return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
}

/**
 * 获取容器类型 Badge
 */
export function getContainerTypeBadge(sourceType: string | null | undefined): React.ReactElement {
  if (!sourceType) return <Badge variant="secondary">-</Badge>
  
  const typeMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    sea_container: { label: '海柜', variant: 'default' },
    company_trailer: { label: '公司拖车', variant: 'secondary' },
  }
  
  const typeInfo = typeMap[sourceType] || { label: sourceType, variant: 'outline' as const }
  return <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
}

