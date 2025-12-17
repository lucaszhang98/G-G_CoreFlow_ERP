/**
 * 预约管理批量删除 API 路由
 * 
 * 注意：预约删除需要回退板数，不能使用通用框架，必须自定义处理
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { AppointmentDeleteService } from '@/lib/services/appointment-delete.service'

export async function POST(request: NextRequest) {
  try {
    // 检查权限
    const permissionResult = await checkPermission(['oms'])
    if (permissionResult.error) return permissionResult.error

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '请提供要删除的记录ID列表' },
        { status: 400 }
      )
    }

    // 转换为 BigInt
    const bigIntIds = ids.map((id: string | number) => {
      try {
        return BigInt(id)
      } catch {
        throw new Error(`无效的ID: ${id}`)
      }
    })

    // 使用 AppointmentDeleteService 批量删除（自动回退板数）
    const result = await AppointmentDeleteService.deleteAppointments(bigIntIds)

    return NextResponse.json({
      message: `成功删除 ${result.count} 条预约记录，剩余板数已回退`,
      count: result.count,
    })
  } catch (error: any) {
    console.error('批量删除预约记录失败:', error)
    return NextResponse.json(
      { error: error.message || '批量删除失败' },
      { status: 500 }
    )
  }
}


