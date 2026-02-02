/**
 * 提柜管理导出Excel生成器
 * 用于导出提柜管理列表数据为Excel文件
 */

import ExcelJS from 'exceljs'

/**
 * 提柜管理导出数据接口
 */
export interface PickupManagementExportData {
  container_number: string | null
  mbl: string | null
  port_location: string | null
  port_text: string | null
  shipping_line: string | null
  customer_name: string | null
  container_type: string | null
  carrier_name: string | null
  driver_code: string | null
  do_issued: boolean | null
  order_date: Date | string | null
  eta_date: Date | string | null
  operation_mode_display: string | null
  delivery_location: string | null
  lfd_date: Date | string | null
  pickup_date: Date | string | null
  ready_date: Date | string | null
  return_deadline: Date | string | null
  warehouse_account: string | null
  earliest_appointment_time: Date | string | null
  current_location: string | null
  status: string | null
  notes: string | null
  created_at: Date | string | null
  updated_at: Date | string | null
}

/**
 * 状态映射
 */
const STATUS_MAP: Record<string, string> = {
  planned: '计划中',
  in_transit: '运输中',
  delivered: '已送达',
  unloaded: '已卸空',
  returned: '已还柜',
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date | string | null): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return ''
  }
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm
 */
function formatDateTime(date: Date | string | null): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    const hours = String(d.getUTCHours()).padStart(2, '0')
    const minutes = String(d.getUTCMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch {
    return ''
  }
}

/**
 * 格式化布尔值
 */
function formatBoolean(value: boolean | null): string {
  if (value === null || value === undefined) return ''
  return value ? '是' : '否'
}

/**
 * 生成提柜管理导出Excel
 */
export async function generatePickupManagementExportExcel(
  rows: PickupManagementExportData[],
  filename: string = '提柜管理'
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('提柜数据', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  const columns: Array<{ header: string; key: string; width: number }> = [
    { header: '柜号', key: 'container_number', width: 18 },
    { header: 'MBL', key: 'mbl', width: 18 },
    { header: '码头/查验站', key: 'port_location', width: 15 },
    { header: '码头位置', key: 'port_text', width: 12 },
    { header: '船司', key: 'shipping_line', width: 12 },
    { header: '客户', key: 'customer_name', width: 18 },
    { header: '柜型', key: 'container_type', width: 10 },
    { header: '承运公司', key: 'carrier_name', width: 15 },
    { header: '司机', key: 'driver_code', width: 12 },
    { header: 'DO', key: 'do_issued', width: 8 },
    { header: '订单日期', key: 'order_date', width: 12 },
    { header: 'ETA', key: 'eta_date', width: 12 },
    { header: '操作方式', key: 'operation_mode_display', width: 10 },
    { header: '送货地', key: 'delivery_location', width: 15 },
    { header: 'LFD', key: 'lfd_date', width: 12 },
    { header: '提柜日期', key: 'pickup_date', width: 16 },
    { header: '就绪日期', key: 'ready_date', width: 12 },
    { header: '还柜日期', key: 'return_deadline', width: 12 },
    { header: '约仓账号', key: 'warehouse_account', width: 15 },
    { header: '最早预约时间', key: 'earliest_appointment_time', width: 18 },
    { header: '现在位置', key: 'current_location', width: 14 },
    { header: '状态', key: 'status', width: 10 },
    { header: '备注', key: 'notes', width: 25 },
    { header: '创建时间', key: 'created_at', width: 18 },
    { header: '更新时间', key: 'updated_at', width: 18 },
  ]

  worksheet.columns = columns

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6C5CE7' },
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 20

  rows.forEach((row) => {
    worksheet.addRow({
      container_number: row.container_number || '',
      mbl: row.mbl || '',
      port_location: row.port_location || '',
      port_text: row.port_text || '',
      shipping_line: row.shipping_line || '',
      customer_name: row.customer_name || '',
      container_type: row.container_type || '',
      carrier_name: row.carrier_name || '',
      driver_code: row.driver_code || '',
      do_issued: formatBoolean(row.do_issued),
      order_date: formatDate(row.order_date),
      eta_date: formatDate(row.eta_date),
      operation_mode_display: row.operation_mode_display || '',
      delivery_location: row.delivery_location || '',
      lfd_date: formatDate(row.lfd_date),
      pickup_date: formatDateTime(row.pickup_date),
      ready_date: formatDate(row.ready_date),
      return_deadline: formatDate(row.return_deadline),
      warehouse_account: row.warehouse_account || '',
      earliest_appointment_time: formatDateTime(row.earliest_appointment_time),
      current_location: row.current_location || '',
      status: STATUS_MAP[row.status || ''] || row.status || '',
      notes: row.notes || '',
      created_at: formatDate(row.created_at),
      updated_at: formatDate(row.updated_at),
    })
  })

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: 'middle', wrapText: true }
      row.height = 18
      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' },
          }
        })
      }
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        }
      })
    }
  })

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  }

  return workbook
}
