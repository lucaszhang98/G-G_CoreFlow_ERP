/**
 * POST /api/wms/outbound-shipments/batch-update
 * 批量更新出库管理（与单行 PUT 同一套字段与校验）
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  checkPermission,
  WMS_FULL_ACCESS_PERMISSION_OPTIONS,
  handleError,
} from '@/lib/api/helpers'
import { outboundShipmentConfig } from '@/lib/crud/configs/outbound-shipments'
import { applyOutboundShipmentRequestBody } from '@/lib/services/outbound-shipment-apply-request-body'

export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(
      outboundShipmentConfig.permissions.update,
      WMS_FULL_ACCESS_PERMISSION_OPTIONS
    )
    if (permissionResult.error) return permissionResult.error
    const currentUser = permissionResult.user

    const body = await request.json()
    const { ids, updates } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请提供要更新的记录ID列表（appointment_id）' }, { status: 400 })
    }

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '请提供要更新的字段' }, { status: 400 })
    }

    for (const rawId of ids) {
      const id = String(rawId).trim()
      if (!id) continue
      const err = await applyOutboundShipmentRequestBody(id, updates, currentUser)
      if (err) {
        return NextResponse.json({ error: `预约 ${id}: ${err.error}` }, { status: err.status })
      }
    }

    return NextResponse.json({
      message: `成功更新 ${ids.length} 条出库管理记录`,
      count: ids.length,
    })
  } catch (error: unknown) {
    return handleError(error, '批量更新出库管理失败')
  }
}
