import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { generateAppointmentExportExcel, AppointmentExportData } from '@/lib/utils/appointment-export-excel'

/**
 * GET /api/wms/delivery-appointments/export
 * 导出送货预约数据为Excel文件
 * 
 * 查询参数：
 * - all=true: 导出全部数据
 * - 其他参数与列表API相同（用于导出筛选结果）：
 *   - search: 搜索关键词
 *   - filter_*: 各种筛选条件
 *   - sort, order: 排序
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const exportAll = searchParams.get('all') === 'true'

    // 构建查询条件（与列表API相同的逻辑）
    const where: any = {}

    // 如果不是导出全部，则应用筛选条件
    if (!exportAll) {
      // 搜索条件（搜索预约编号和PO）
      const search = searchParams.get('search')
      if (search && search.trim()) {
        where.OR = [
          { reference_number: { contains: search, mode: 'insensitive' as const } },
          { po: { contains: search, mode: 'insensitive' as const } },
        ]
      }

      // 预约类型筛选
      const appointment_type = searchParams.get('filter_appointment_type')
      if (appointment_type && appointment_type !== '__all__') {
        where.appointment_type = appointment_type
      }

      // 配送方式筛选
      const delivery_method = searchParams.get('filter_delivery_method')
      if (delivery_method && delivery_method !== '__all__') {
        where.delivery_method = delivery_method
      }

      // 预约账号筛选
      const appointment_account = searchParams.get('filter_appointment_account')
      if (appointment_account && appointment_account !== '__all__') {
        where.appointment_account = appointment_account
      }

      // 起始地筛选
      const origin_location = searchParams.get('filter_origin_location')
      if (origin_location && origin_location !== '__all__') {
        where.origin_location_id = BigInt(origin_location)
      }

      // 目的地筛选
      const destination_location = searchParams.get('filter_destination_location')
      if (destination_location && destination_location !== '__all__') {
        where.location_id = BigInt(destination_location)
      }

      // 拒收筛选
      const rejected = searchParams.get('filter_rejected')
      if (rejected && rejected !== '__all__') {
        where.rejected = rejected === 'true'
      }

      // 状态筛选（支持多选，逗号分隔）
      const statusParam = searchParams.get('filter_status')
      if (statusParam && statusParam !== '__all__') {
        const statusValues = statusParam.split(',').map((s) => s.trim()).filter(Boolean)
        if (statusValues.length === 1) {
          where.status = statusValues[0]
        } else if (statusValues.length > 1) {
          where.status = { in: statusValues }
        }
      }

      // 日期范围筛选
      const confirmed_start_from = searchParams.get('filter_confirmed_start_from')
      const confirmed_start_to = searchParams.get('filter_confirmed_start_to')
      if (confirmed_start_from || confirmed_start_to) {
        where.confirmed_start = {}
        if (confirmed_start_from) {
          where.confirmed_start.gte = new Date(confirmed_start_from)
        }
        if (confirmed_start_to) {
          const endDate = new Date(confirmed_start_to)
          endDate.setHours(23, 59, 59, 999)
          where.confirmed_start.lte = endDate
        }
      }
    }

    // 排序
    const sort = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
    const orderBy: any = { [sort]: order }

    // 查询数据（限制最多10000条）
    const appointments = await prisma.delivery_appointments.findMany({
      where,
      orderBy,
      take: 10000, // 防止导出过多数据导致性能问题
      include: {
        appointment_detail_lines: {
          select: {
            estimated_pallets: true,
          },
        },
        locations_delivery_appointments_origin_location_idTolocations: {
          select: {
            location_id: true,
            location_code: true,
            name: true,
          },
        },
        locations: {
          select: {
            location_id: true,
            location_code: true,
            name: true,
          },
        },
      },
    })

    // 转换数据格式
    const exportData: AppointmentExportData[] = appointments.map((appointment: any) => {
      // 动态计算 total_pallets: 从 appointment_detail_lines 汇总
      let totalPallets = 0
      if (appointment.appointment_detail_lines && Array.isArray(appointment.appointment_detail_lines)) {
        totalPallets = appointment.appointment_detail_lines.reduce((sum: number, line: any) => {
          if (line.estimated_pallets !== null && line.estimated_pallets !== undefined) {
            return sum + Number(line.estimated_pallets)
          }
          return sum
        }, 0)
      }

      return {
        reference_number: appointment.reference_number,
        delivery_method: appointment.delivery_method,
        appointment_account: appointment.appointment_account,
        appointment_type: appointment.appointment_type,
        origin_location: appointment.locations_delivery_appointments_origin_location_idTolocations?.location_code ||
                        appointment.locations_delivery_appointments_origin_location_idTolocations?.name || null,
        destination_location: appointment.locations?.location_code ||
                            appointment.locations?.name || null,
        confirmed_start: appointment.confirmed_start,
        total_pallets: totalPallets,
        rejected: appointment.rejected,
        po: appointment.po,
        notes: appointment.notes,
        status: appointment.status,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
      }
    })

    // 生成Excel
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = exportAll
      ? `送货预约管理_全部_${timestamp}`
      : `送货预约管理_筛选_${timestamp}`

    const workbook = await generateAppointmentExportExcel(exportData, filename)

    // 生成buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // 返回Excel文件
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('导出送货预约数据失败:', error)
    return NextResponse.json(
      {
        error: error.message || '导出送货预约数据失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

