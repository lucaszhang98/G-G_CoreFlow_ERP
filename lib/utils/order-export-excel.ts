/**
 * 订单管理导出Excel生成器
 * 用于导出订单列表数据为Excel文件
 */

import ExcelJS from 'exceljs'

/**
 * 订单导出数据接口
 */
export interface OrderExportData {
  order_number: string | null
  customer_name: string | null
  customer_code: string | null
  user_name: string | null // 负责人
  order_date: Date | string | null
  status: string | null
  operation_mode: string | null
  delivery_location: string | null
  container_type: string | null
  container_volume: number | null
  eta_date: Date | string | null
  lfd_date: Date | string | null
  pickup_date: Date | string | null
  ready_date: Date | string | null
  return_deadline: Date | string | null
  carrier_name: string | null // 承运公司
  port_location: string | null // 码头/查验站
  mbl_number: string | null
  do_issued: boolean | null
  notes: string | null
  created_at: Date | string | null
  updated_at: Date | string | null
}

/**
 * 状态映射
 */
const STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  confirmed: '已确认',
  shipped: '已发货',
  delivered: '已送达',
  archived: '完成留档',
  cancelled: '已取消',
}

/**
 * 操作方式映射
 */
const OPERATION_MODE_MAP: Record<string, string> = {
  unload: '拆柜',
  direct_delivery: '直送',
}

/**
 * 格式化日期为 YYYY-MM-DD
 * 使用UTC时间避免时区转换问题
 */
function formatDate(date: Date | string | null): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    // 使用UTC时间避免时区问题（数据库存储的是UTC时间）
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
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
 * 生成订单导出Excel
 * @param orders 订单数据数组
 * @param filename 文件名（不含扩展名）
 * @returns ExcelJS Workbook 对象
 */
export async function generateOrderExportExcel(
  orders: OrderExportData[],
  filename: string = '订单管理'
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('订单数据', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }], // 冻结首行
  })

  // 定义列
  const columns: Array<{
    header: string
    key: string
    width: number
  }> = [
    { header: '订单号', key: 'order_number', width: 18 },
    { header: '客户代码', key: 'customer_code', width: 15 },
    { header: '客户名称', key: 'customer_name', width: 20 },
    { header: '负责人', key: 'user_name', width: 12 },
    { header: '订单日期', key: 'order_date', width: 12 },
    { header: '状态', key: 'status', width: 10 },
    { header: '操作方式', key: 'operation_mode', width: 10 },
    { header: '送货地点', key: 'delivery_location', width: 15 },
    { header: '柜型', key: 'container_type', width: 10 },
    { header: '柜体积', key: 'container_volume', width: 10 },
    { header: 'ETA日期', key: 'eta_date', width: 12 },
    { header: 'LFD日期', key: 'lfd_date', width: 12 },
    { header: '提柜日期', key: 'pickup_date', width: 12 },
    { header: '预备日期', key: 'ready_date', width: 12 },
    { header: '还柜期限', key: 'return_deadline', width: 12 },
    { header: '承运公司', key: 'carrier_name', width: 15 },
    { header: '码头/查验站', key: 'port_location', width: 15 },
    { header: 'MBL号码', key: 'mbl_number', width: 18 },
    { header: 'DO已签发', key: 'do_issued', width: 10 },
    { header: '备注', key: 'notes', width: 30 },
    { header: '创建时间', key: 'created_at', width: 18 },
    { header: '更新时间', key: 'updated_at', width: 18 },
  ]

  worksheet.columns = columns

  // 设置表头样式
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 20

  // 添加数据
  orders.forEach((order) => {
    // 只显示location code，不显示完整的location信息
    const deliveryLocationCode = typeof order.delivery_location === 'string' 
      ? order.delivery_location 
      : (order.delivery_location as any)?.location_code || ''
    
    worksheet.addRow({
      order_number: order.order_number || '',
      customer_code: order.customer_code || '',
      customer_name: order.customer_name || '',
      user_name: order.user_name || '',
      order_date: formatDate(order.order_date),
      status: STATUS_MAP[order.status || ''] || order.status || '',
      operation_mode: OPERATION_MODE_MAP[order.operation_mode || ''] || order.operation_mode || '',
      delivery_location: deliveryLocationCode,
      container_type: order.container_type || '',
      container_volume: order.container_volume ?? '',
      eta_date: formatDate(order.eta_date),
      lfd_date: formatDate(order.lfd_date),
      pickup_date: formatDate(order.pickup_date),
      ready_date: formatDate(order.ready_date),
      return_deadline: formatDate(order.return_deadline),
      carrier_name: order.carrier_name || '',
      port_location: order.port_location || '',
      mbl_number: order.mbl_number || '',
      do_issued: formatBoolean(order.do_issued),
      notes: order.notes || '',
      created_at: formatDate(order.created_at),
      updated_at: formatDate(order.updated_at),
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

