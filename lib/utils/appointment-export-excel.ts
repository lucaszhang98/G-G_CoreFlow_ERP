/**
 * 送货预约导出Excel生成器
 * 用于导出送货预约列表数据为Excel文件
 */

import ExcelJS from 'exceljs'

/**
 * 送货预约导出数据接口
 */
export interface AppointmentExportData {
  reference_number: string | null
  delivery_method: string | null
  appointment_account: string | null
  appointment_type: string | null
  origin_location: string | null
  destination_location: string | null
  confirmed_start: Date | string | null
  total_pallets: number | null
  rejected: boolean | null
  po: string | null
  notes: string | null
  status: string | null
  created_at: Date | string | null
  updated_at: Date | null
}

/**
 * 预约类型映射
 */
const APPOINTMENT_TYPE_MAP: Record<string, string> = {
  delivery: '送货',
  pickup: '提货',
}

/**
 * 配送方式映射
 */
const DELIVERY_METHOD_MAP: Record<string, string> = {
  direct: '直送',
  transit: '中转',
}

/**
 * 状态映射
 */
const STATUS_MAP: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm
 * 使用UTC时间避免时区转换问题
 */
function formatDateTime(date: Date | string | null): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    // 使用UTC时间避免时区问题（数据库存储的是UTC时间）
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
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date | string | null): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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
 * 生成送货预约导出Excel
 * @param appointments 送货预约数据数组
 * @param filename 文件名（不含扩展名）
 * @returns ExcelJS Workbook 对象
 */
export async function generateAppointmentExportExcel(
  appointments: AppointmentExportData[],
  filename: string = '送货预约管理'
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('预约数据', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }], // 冻结首行
  })

  // 定义列
  const columns: Array<{
    header: string
    key: string
    width: number
  }> = [
    { header: '预约编号', key: 'reference_number', width: 20 },
    { header: '配送方式', key: 'delivery_method', width: 12 },
    { header: '预约账户', key: 'appointment_account', width: 18 },
    { header: '预约类型', key: 'appointment_type', width: 12 },
    { header: '起始位置', key: 'origin_location', width: 15 },
    { header: '目的位置', key: 'destination_location', width: 15 },
    { header: '确认开始时间', key: 'confirmed_start', width: 20 },
    { header: '总板数', key: 'total_pallets', width: 10 },
    { header: '拒收', key: 'rejected', width: 8 },
    { header: 'PO', key: 'po', width: 20 },
    { header: '备注', key: 'notes', width: 35 },
    { header: '创建时间', key: 'created_at', width: 20 },
    { header: '更新时间', key: 'updated_at', width: 20 },
  ]

  worksheet.columns = columns

  // 设置表头样式
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF28A745' }, // 绿色主题（区别于订单的蓝色）
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 20

  // 添加数据
  appointments.forEach((appointment) => {
    worksheet.addRow({
      reference_number: appointment.reference_number || '',
      delivery_method: DELIVERY_METHOD_MAP[appointment.delivery_method || ''] || appointment.delivery_method || '',
      appointment_account: appointment.appointment_account || '',
      appointment_type: APPOINTMENT_TYPE_MAP[appointment.appointment_type || ''] || appointment.appointment_type || '',
      origin_location: appointment.origin_location || '',
      destination_location: appointment.destination_location || '',
      confirmed_start: formatDateTime(appointment.confirmed_start),
      total_pallets: appointment.total_pallets ?? '',
      rejected: formatBoolean(appointment.rejected),
      po: appointment.po || '',
      notes: appointment.notes || '',
      created_at: formatDate(appointment.created_at),
      updated_at: formatDate(appointment.updated_at),
    })
  })

  // 设置数据行样式
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      // 跳过表头
      row.alignment = { vertical: 'middle', wrapText: true }
      row.height = 18

      // 斑马纹
      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' },
          }
        })
      }

      // 边框
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

  // 添加筛选器
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  }

  return workbook
}

