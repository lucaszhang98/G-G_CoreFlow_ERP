/**
 * 入库管理列表导出 Excel（与列表列大致对齐）
 */
import ExcelJS from 'exceljs'

const STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  arrived: '已到仓',
  received: '已入库',
  printed: '已打印',
  inspection: '查验',
  closed_area: '封闭区',
}

function formatDate(date: Date | string | null | undefined): string {
  if (date == null || date === '') return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

function userDisplay(u: { username?: string | null; full_name?: string | null } | null | undefined): string {
  if (!u) return ''
  const un = u.username != null && String(u.username).trim() !== '' ? String(u.username).trim() : ''
  if (un) return un
  return u.full_name != null ? String(u.full_name) : ''
}

function locationRegistrationLabel(row: any): string {
  const lots: any[] = row.inventory_lots || []
  if (lots.length === 0) return '未完成'
  const allHave = lots.every(
    (lot: any) => lot.storage_location_code != null && String(lot.storage_location_code).trim() !== ''
  )
  return allHave ? '已完成' : '未完成'
}

export async function generateInboundReceiptExportExcel(rows: any[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('入库管理', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const headers = [
    '客户名称',
    '柜号',
    '仓点数',
    '预报日期',
    '到港日期',
    'Ready日期',
    'LFD',
    '提柜日期',
    '现在位置',
    '承运公司',
    '状态',
    '已到仓',
    '拆柜日期',
    '拆柜人员',
    '入库人员',
    '卸货方式',
    '送货进度(%)',
    '位置登记',
  ]

  sheet.addRow(headers)
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.eachCell((c) => {
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8E8E8' },
    }
  })

  for (const row of rows) {
    const carrierName = row.carrier?.name ?? row.carriers?.name ?? ''
    sheet.addRow([
      row.customer_name ?? '',
      row.container_number ?? '',
      row.warehouse_point_count ?? '',
      formatDate(row.order_date),
      formatDate(row.eta_date),
      formatDate(row.ready_date),
      formatDate(row.lfd_date),
      formatDate(row.pickup_date),
      row.current_location ?? '',
      carrierName,
      STATUS_LABEL[row.status] ?? row.status ?? '',
      row.arrived_at_warehouse === true ? '是' : row.arrived_at_warehouse === false ? '否' : '',
      formatDate(row.planned_unload_at),
      userDisplay(row.users_inbound_receipt_unloaded_byTousers),
      userDisplay(row.users_inbound_receipt_received_byTousers),
      row.unload_method_name ?? '',
      row.delivery_progress != null && row.delivery_progress !== ''
        ? Math.round(Number(row.delivery_progress) * 100) / 100
        : '',
      locationRegistrationLabel(row),
    ])
  }

  const widths = [14, 14, 8, 12, 12, 12, 12, 12, 16, 14, 10, 8, 12, 12, 12, 14, 12, 10]
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })

  return workbook
}
