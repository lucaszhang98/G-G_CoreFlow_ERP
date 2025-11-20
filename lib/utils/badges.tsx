/**
 * Badge 组件工具函数
 */

import React from "react"
import { Badge } from "@/components/ui/badge"

/**
 * 获取状态 Badge
 */
export function getStatusBadge(status: string | null | undefined): React.ReactElement {
  if (!status) return <Badge variant="secondary">-</Badge>
  
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: '待处理', variant: 'secondary' },
    transit: { label: '运输中', variant: 'default' },
    delivered: { label: '已交付', variant: 'default' },
    canceled: { label: '已取消', variant: 'destructive' },
    rejected: { label: '已拒绝', variant: 'destructive' },
    confirmed: { label: '已确认', variant: 'default' },
    shipped: { label: '已发货', variant: 'default' },
    cancelled: { label: '已取消', variant: 'destructive' },
    active: { label: '激活', variant: 'default' },
    inactive: { label: '停用', variant: 'secondary' },
  }
  
  const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const }
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

