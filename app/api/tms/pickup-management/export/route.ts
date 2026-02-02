import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import { pickupManagementConfig } from '@/lib/crud/configs/pickup-management'
import { buildFilterConditions, mergeFilterConditions } from '@/lib/crud/filter-helper'
import { enhanceConfigWithSearchFields } from '@/lib/crud/search-config-generator'
import {
  generatePickupManagementExportExcel,
  PickupManagementExportData,
} from '@/lib/utils/pickup-management-export-excel'

/**
 * GET /api/tms/pickup-management/export
 * 导出提柜管理数据为Excel文件
 *
 * 查询参数：
 * - all=true: 导出全部数据
 * - 其他参数与列表API相同（用于导出筛选结果）
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const exportAll = searchParams.get('all') === 'true'

    const enhancedConfig = enhanceConfigWithSearchFields(pickupManagementConfig)
    const where: any = {}

    if (!exportAll) {
      const filterConditions = buildFilterConditions(enhancedConfig, searchParams)
      const mainTableConditions: any[] = []
      const ordersConditions: any = {}
      const mainTableFields = [
        'pickup_id',
        'order_id',
        'status',
        'notes',
        'earliest_appointment_time',
        'current_location',
        'port_text',
        'shipping_line',
        'driver_id',
      ]

      filterConditions.forEach((condition) => {
        Object.keys(condition).forEach((fieldName) => {
          if (mainTableFields.includes(fieldName)) {
            mainTableConditions.push(condition)
          } else {
            Object.assign(ordersConditions, condition)
          }
        })
      })

      if (mainTableConditions.length > 0) {
        mergeFilterConditions(where, mainTableConditions)
      }
      if (Object.keys(ordersConditions).length > 0) {
        where.orders = where.orders ? { ...where.orders, ...ordersConditions } : ordersConditions
      }

      const search = searchParams.get('search') || ''
      if (search) {
        const searchCondition = {
          OR: [
            { order_number: { contains: search, mode: 'insensitive' as const } },
            { mbl_number: { contains: search, mode: 'insensitive' as const } },
          ],
        }
        where.orders = where.orders ? { ...where.orders, ...searchCondition } : searchCondition
      }
    }

    const sort = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
    const mainTableFields = [
      'pickup_id',
      'status',
      'notes',
      'current_location',
      'port_text',
      'shipping_line',
      'driver_id',
      'created_at',
      'updated_at',
    ]
    const orderBy: any =
      sort === 'earliest_appointment_time'
        ? { orders: { appointment_time: order } }
        : mainTableFields.includes(sort)
          ? { [sort]: order }
          : { orders: { [sort]: order } }

    const pickups = await prisma.pickup_management.findMany({
      where,
      orderBy,
      take: 10000,
      include: {
        orders: {
          select: {
            order_id: true,
            order_number: true,
            order_date: true,
            mbl_number: true,
            do_issued: true,
            container_type: true,
            eta_date: true,
            lfd_date: true,
            pickup_date: true,
            ready_date: true,
            return_deadline: true,
            warehouse_account: true,
            appointment_time: true,
            operation_mode: true,
            port_location: true,
            port_location_id: true,
            delivery_location: true,
            delivery_location_id: true,
            carrier_id: true,
            locations_orders_port_location_idTolocations: {
              select: { location_id: true, name: true, location_code: true, location_type: true },
            },
            locations_orders_delivery_location_idTolocations: {
              select: { location_id: true, name: true, location_code: true, location_type: true },
            },
            customers: { select: { id: true, name: true, code: true } },
            carriers: { select: { carrier_id: true, name: true, carrier_code: true } },
          },
        },
        drivers: {
          select: { driver_id: true, driver_code: true, license_number: true, license_plate: true },
        },
      },
    })

    const exportData: PickupManagementExportData[] = pickups.map((pickup: any) => {
      const serialized = serializeBigInt(pickup)
      const order = serialized.orders
      return {
        container_number: order?.order_number || null,
        mbl: order?.mbl_number || null,
        port_location:
          order?.locations_orders_port_location_idTolocations?.location_code || order?.port_location || null,
        port_text: serialized.port_text || null,
        shipping_line: serialized.shipping_line || null,
        customer_name: order?.customers?.name || null,
        container_type: order?.container_type || null,
        carrier_name: order?.carriers?.name || null,
        driver_code: serialized.drivers?.driver_code || null,
        do_issued: order?.do_issued ?? null,
        order_date: order?.order_date || null,
        eta_date: order?.eta_date || null,
        operation_mode_display:
          order?.operation_mode === 'unload'
            ? '拆柜'
            : order?.operation_mode === 'direct_delivery'
              ? '直送'
              : order?.operation_mode || null,
        delivery_location:
          order?.locations_orders_delivery_location_idTolocations?.location_code ||
          order?.delivery_location ||
          null,
        lfd_date: order?.lfd_date || null,
        pickup_date: order?.pickup_date || null,
        ready_date: order?.ready_date || null,
        return_deadline: order?.return_deadline || null,
        warehouse_account: order?.warehouse_account || null,
        earliest_appointment_time:
          order?.appointment_time || serialized.earliest_appointment_time || null,
        current_location: serialized.current_location || null,
        status: serialized.status || null,
        notes: serialized.notes || null,
        created_at: serialized.created_at || null,
        updated_at: serialized.updated_at || null,
      }
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = exportAll
      ? `提柜管理_全部_${timestamp}`
      : `提柜管理_筛选_${timestamp}`

    const workbook = await generatePickupManagementExportExcel(exportData, filename)
    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('导出提柜管理数据失败:', error)
    return NextResponse.json(
      {
        error: error.message || '导出提柜管理数据失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
