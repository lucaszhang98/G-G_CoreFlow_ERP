/**
 * 提柜管理批量导入 Service
 * 仅按柜号匹配已有订单并更新，不新建任何数据；找不到订单则报错
 * 可修改字段：MBL，码头/查验站，码头位置，船司，柜型，承运公司，司机，ETA，LFD，提柜日期，还柜日期，现在位置
 */

import prisma from '@/lib/prisma'
import { BaseImportService } from './import/base-import.service'
import { ImportConfig, ImportError } from './import/types'
import {
  pickupManagementImportRowSchema,
  PickupManagementImportRow,
} from '@/lib/validations/pickup-management-import'
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date'

/** 主数据：订单号->order_id, 承运名称->carrier_id, 司机代码->driver_id, 位置代码->location_id */
interface PickupMasterData {
  orderByNumber: Map<string, { order_id: bigint }>
  carrierByName: Map<string, bigint>
  driverByCode: Map<string, bigint>
  locationByCode: Map<string, bigint>
}

/** Excel 日期序列号起点（1899-12-30 UTC） */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)

/**
 * 解析日期为 UTC 零点，不做任何时区转换（用户输入的日期即当作该日 00:00:00 UTC 存储）
 */
function parseDate(value: string | number | undefined): Date | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') {
    if (value > 1000 && value < 100000) {
      return new Date(EXCEL_EPOCH_UTC + Math.floor(value) * 86400000)
    }
    return null
  }
  const s = String(value).trim()
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    return new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 0, 0, 0, 0))
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/**
 * 解析日期时间为 UTC，不做任何时区转换（用户输入的日期时间即当作 UTC 存储）
 * 支持 YYYY-MM-DD、YYYY-MM-DD HH:mm、YYYY-MM-DDTHH:mm 等格式
 */
function parseDateTime(value: string | number | undefined): Date | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') {
    if (value > 1000 && value < 100000) {
      return new Date(EXCEL_EPOCH_UTC + Math.round(value * 86400000))
    }
    return null
  }
  const s = String(value).trim()
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{3}))?$/)
  if (m) {
    return new Date(
      Date.UTC(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10),
        parseInt(m[4], 10),
        parseInt(m[5], 10),
        parseInt(m[6] || '0', 10),
        parseInt((m[7] || '0').padEnd(3, '0').slice(0, 3), 10)
      )
    )
  }
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    return new Date(Date.UTC(parseInt(dateOnly[1], 10), parseInt(dateOnly[2], 10) - 1, parseInt(dateOnly[3], 10), 0, 0, 0, 0))
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

const pickupManagementImportConfig: ImportConfig<PickupManagementImportRow> = {
  headerMap: {
    '柜号': 'container_number',
    'MBL': 'mbl',
    '码头/查验站': 'port_location_code',
    '码头位置': 'port_text',
    '船司': 'shipping_line',
    '柜型': 'container_type',
    '承运公司': 'carrier_name',
    '司机': 'driver_code',
    'ETA': 'eta_date',
    'LFD': 'lfd_date',
    '提柜日期': 'pickup_date',
    '还柜日期': 'return_deadline',
    '现在位置': 'current_location',
  },

  validationSchema: pickupManagementImportRowSchema,

  requiredRoles: ['admin', 'tms_manager'],

  loadMasterData: async (): Promise<PickupMasterData> => {
    const [orders, carriers, drivers, locations] = await Promise.all([
      prisma.orders.findMany({ select: { order_id: true, order_number: true } }),
      prisma.carriers.findMany({ select: { carrier_id: true, name: true, carrier_code: true } }),
      prisma.drivers.findMany({ select: { driver_id: true, driver_code: true } }),
      prisma.locations.findMany({
        where: { location_type: 'port' },
        select: { location_id: true, location_code: true, name: true },
      }),
    ])

    const orderByNumber = new Map(orders.map((o) => [o.order_number, { order_id: o.order_id }]))
    const carrierByName = new Map<string, bigint>()
    carriers.forEach((c) => {
      if (c.name) carrierByName.set(c.name.trim(), c.carrier_id)
      if (c.carrier_code) carrierByName.set(c.carrier_code.trim(), c.carrier_id)
    })
    const driverByCode = new Map(drivers.map((d) => [d.driver_code?.trim() || '', d.driver_id]))
    const locationByCode = new Map(
      locations.map((l) => [l.location_code?.trim() || l.name?.trim() || '', l.location_id])
    )

    return { orderByNumber, carrierByName, driverByCode, locationByCode }
  },

  checkDuplicates: async (
    data: PickupManagementImportRow[],
    masterData?: PickupMasterData
  ): Promise<ImportError[]> => {
    const errors: ImportError[] = []
    if (!masterData) return errors

    data.forEach((row, i) => {
      const order = masterData.orderByNumber.get(row.container_number)
      if (!order) {
        errors.push({
          row: i + 2,
          field: '柜号',
          message: `未找到柜号对应的订单："${row.container_number}"，导入仅支持更新已有订单，不能新建数据`,
        })
      }
    })
    return errors
  },

  executeImport: async (
    data: PickupManagementImportRow[],
    userId: bigint,
    masterData?: PickupMasterData
  ): Promise<{ successCount: number }> => {
    if (!masterData) throw new Error('主数据未加载')

    let successCount = 0
    for (const row of data) {
      const orderInfo = masterData.orderByNumber.get(row.container_number)
      if (!orderInfo) continue

      const orderId = orderInfo.order_id

      const orderUpdate: any = {
        updated_by: userId,
        updated_at: new Date(),
      }
      if (row.mbl !== undefined) orderUpdate.mbl_number = row.mbl || null
      if (row.port_location_code !== undefined) {
        orderUpdate.port_location_id =
          masterData.locationByCode.get(row.port_location_code) || null
      }
      if (row.container_type !== undefined) orderUpdate.container_type = row.container_type || null
      if (row.eta_date !== undefined) orderUpdate.eta_date = parseDate(row.eta_date)
      if (row.lfd_date !== undefined) orderUpdate.lfd_date = parseDate(row.lfd_date)
      if (row.pickup_date !== undefined) orderUpdate.pickup_date = parseDateTime(row.pickup_date)
      if (row.return_deadline !== undefined)
        orderUpdate.return_deadline = parseDate(row.return_deadline)
      if (row.carrier_name !== undefined) {
        orderUpdate.carrier_id = masterData.carrierByName.get(row.carrier_name) || null
      }

      const pickupUpdate: any = {
        updated_by: userId,
        updated_at: new Date(),
      }
      if (row.port_text !== undefined) pickupUpdate.port_text = row.port_text || null
      if (row.shipping_line !== undefined) pickupUpdate.shipping_line = row.shipping_line || null
      if (row.driver_code !== undefined) {
        pickupUpdate.driver_id = masterData.driverByCode.get(row.driver_code) || null
      }
      if (row.current_location !== undefined)
        pickupUpdate.current_location = row.current_location || null

      const existingPickup = await prisma.pickup_management.findUnique({
        where: { order_id: orderId },
        select: { pickup_id: true },
      })

      await prisma.$transaction(async (tx) => {
        if (Object.keys(orderUpdate).length > 2) {
          await tx.orders.update({
            where: { order_id: orderId },
            data: orderUpdate,
          })
        }

        if (existingPickup && Object.keys(pickupUpdate).length > 2) {
          await tx.pickup_management.update({
            where: { pickup_id: existingPickup.pickup_id },
            data: pickupUpdate,
          })
        }
      })

      if (orderUpdate.pickup_date !== undefined || orderUpdate.eta_date !== undefined) {
        const updatedOrder = await prisma.orders.findUnique({
          where: { order_id: orderId },
          select: { pickup_date: true, eta_date: true },
        })
        if (updatedOrder) {
          const calculatedUnloadDate = calculateUnloadDate(
            updatedOrder.pickup_date,
            updatedOrder.eta_date
          )
          const inbound = await prisma.inbound_receipt.findUnique({
            where: { order_id: orderId },
            select: { inbound_receipt_id: true },
          })
          if (inbound && calculatedUnloadDate) {
            await prisma.inbound_receipt.update({
              where: { inbound_receipt_id: inbound.inbound_receipt_id },
              data: {
                planned_unload_at: calculatedUnloadDate,
                updated_by: userId,
                updated_at: new Date(),
              },
            })
          }
        }
      }

      successCount++
    }

    return { successCount }
  },
}

export const pickupManagementImportService = new BaseImportService(pickupManagementImportConfig)
