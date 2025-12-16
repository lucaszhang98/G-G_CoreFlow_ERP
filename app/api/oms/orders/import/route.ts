import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { orderImportRowSchema, ImportError, ImportResult, OrderImportRow } from '@/lib/validations/order-import'

/**
 * POST - 批量导入订单
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查权限
    if (!['admin', 'oms_manager'].includes(session.user.role || '')) {
      return NextResponse.json({ error: '无权限导入订单' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '未上传文件' }, { status: 400 })
    }

    // 读取Excel文件
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // 转换为JSON，保留原始类型
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' })

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'Excel文件为空' }, { status: 400 })
    }

    // ===== 第一步：预加载主数据（性能优化） =====
    console.log('正在加载主数据...')
    
    const [customers, locations] = await Promise.all([
      prisma.customers.findMany({
        select: { id: true, code: true, name: true }
      }),
      prisma.locations.findMany({
        select: { location_id: true, location_code: true, name: true }
      })
    ])

    // 创建快速查找Map
    const customerMap = new Map(customers.map(c => [c.code, c.id]))
    const locationMap = new Map(locations.map(l => [l.location_code, l.location_id]))

    console.log(`已加载 ${customers.length} 个客户，${locations.length} 个位置`)

    // ===== 第二步：解析和校验所有行 =====
    const errors: ImportError[] = []
    const validRows: (OrderImportRow & { rowIndex: number })[] = []

    for (let i = 0; i < rawData.length; i++) {
      const rowIndex = i + 2 // Excel行号（第1行是表头）
      const rawRow = rawData[i]

      try {
        // 映射Excel列名到schema字段名
        const mappedRow = {
          order_number: rawRow['订单号'],
          customer_code: rawRow['客户代码'],
          user_id: rawRow['负责人'],
          order_date: rawRow['订单日期'],
          status: rawRow['状态'],
          operation_mode: rawRow['操作方式'],
          delivery_location_code: rawRow['目的地'],
          total_amount: rawRow['订单金额'],
          discount_amount: rawRow['折扣金额'],
          tax_amount: rawRow['税费'],
          final_amount: rawRow['最终金额'],
          container_type: rawRow['货柜类型'],
          eta_date: rawRow['ETA'],
          lfd_date: rawRow['LFD'],
          pickup_date: rawRow['提柜日期'],
          ready_date: rawRow['就绪日期'],
          return_deadline: rawRow['归还截止日期'],
          mbl_number: rawRow['MBL'],
          do_issued: rawRow['DO'],
          notes: rawRow['备注'],
          detail_delivery_location_code: rawRow['送仓地点'],
          delivery_nature: rawRow['性质'],
          quantity: rawRow['数量'],
          volume: rawRow['体积'],
          fba: rawRow['FBA'],
          detail_notes: rawRow['明细备注'],
          po: rawRow['PO'],
        }

        // Zod校验
        const validatedRow = orderImportRowSchema.parse(mappedRow)

        // 主数据存在性校验
        if (!customerMap.has(validatedRow.customer_code)) {
          errors.push({
            row: rowIndex,
            field: '客户代码',
            message: `客户代码"${validatedRow.customer_code}"不存在`,
            value: validatedRow.customer_code
          })
          continue
        }

        if (!locationMap.has(validatedRow.delivery_location_code)) {
          errors.push({
            row: rowIndex,
            field: '目的地',
            message: `位置代码"${validatedRow.delivery_location_code}"不存在`,
            value: validatedRow.delivery_location_code
          })
          continue
        }

        if (!locationMap.has(validatedRow.detail_delivery_location_code)) {
          errors.push({
            row: rowIndex,
            field: '送仓地点',
            message: `位置代码"${validatedRow.detail_delivery_location_code}"不存在`,
            value: validatedRow.detail_delivery_location_code
          })
          continue
        }

        validRows.push({ ...validatedRow, rowIndex })

      } catch (error: any) {
        if (error.errors) {
          // Zod validation errors
          error.errors.forEach((err: any) => {
            errors.push({
              row: rowIndex,
              field: err.path.join('.'),
              message: err.message,
              value: rawRow[err.path[0]]
            })
          })
        } else {
          errors.push({
            row: rowIndex,
            message: error.message || '未知错误'
          })
        }
      }
    }

    // 如果有错误，返回错误列表
    if (errors.length > 0) {
      const result: ImportResult = {
        success: false,
        total: rawData.length,
        successCount: 0,
        errorCount: errors.length,
        errors
      }
      return NextResponse.json(result, { status: 400 })
    }

    // ===== 第三步：按订单号分组（一对多关系处理） =====
    const orderGroups = new Map<string, typeof validRows>()
    
    for (const row of validRows) {
      const existing = orderGroups.get(row.order_number)
      if (existing) {
        existing.push(row)
      } else {
        orderGroups.set(row.order_number, [row])
      }
    }

    console.log(`共 ${orderGroups.size} 个订单，${validRows.length} 个明细`)

    // 检查同一订单的订单字段是否一致
    for (const [orderNumber, rows] of orderGroups) {
      if (rows.length > 1) {
        const first = rows[0]
        for (let i = 1; i < rows.length; i++) {
          const current = rows[i]
          
          // 检查关键订单字段是否一致
          const orderFields = [
            'customer_code', 'order_date', 'status', 'operation_mode',
            'delivery_location_code', 'container_type', 'eta_date', 'mbl_number', 'do_issued'
          ] as const
          
          for (const field of orderFields) {
            if (first[field] !== current[field]) {
              errors.push({
                row: current.rowIndex,
                field: field,
                message: `订单号"${orderNumber}"的多行数据中，${field}字段不一致`,
                value: current[field]
              })
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      const result: ImportResult = {
        success: false,
        total: rawData.length,
        successCount: 0,
        errorCount: errors.length,
        errors
      }
      return NextResponse.json(result, { status: 400 })
    }

    // ===== 第四步：事务导入（全部成功或全部失败） =====
    const createdOrderIds: string[] = []

    await prisma.$transaction(async (tx) => {
      for (const [orderNumber, rows] of orderGroups) {
        const firstRow = rows[0]
        
        // 检查订单号是否已存在（防止重复导入）
        const existingOrder = await tx.orders.findUnique({
          where: { order_number: orderNumber }
        })

        if (existingOrder) {
          throw new Error(`订单号"${orderNumber}"已存在，请勿重复导入`)
        }

        // 创建订单
        const order = await tx.orders.create({
          data: {
            order_number: firstRow.order_number,
            customer_id: customerMap.get(firstRow.customer_code)!,
            order_date: new Date(firstRow.order_date),
            status: firstRow.status,
            operation_mode: firstRow.operation_mode,
            delivery_location_id: locationMap.get(firstRow.delivery_location_code)!,
            total_amount: firstRow.total_amount,
            discount_amount: firstRow.discount_amount,
            tax_amount: firstRow.tax_amount,
            final_amount: firstRow.final_amount,
            container_type: firstRow.container_type,
            eta_date: new Date(firstRow.eta_date),
            lfd_date: firstRow.lfd_date ? new Date(firstRow.lfd_date) : null,
            pickup_date: firstRow.pickup_date ? new Date(firstRow.pickup_date) : null,
            ready_date: firstRow.ready_date ? new Date(firstRow.ready_date) : null,
            return_deadline: firstRow.return_deadline ? new Date(firstRow.return_deadline) : null,
            mbl_number: firstRow.mbl_number,
            do_issued: firstRow.do_issued,
            notes: firstRow.notes || null,
            created_by: session.user.id ? BigInt(session.user.id) : null,
            updated_by: session.user.id ? BigInt(session.user.id) : null,
          }
        })

        createdOrderIds.push(order.order_id.toString())

        // 创建订单明细
        for (const row of rows) {
          const volume = row.volume
          const estimatedPallets = Math.max(1, Math.round(volume / 2))

          await tx.order_detail.create({
            data: {
              order_id: order.order_id,
              quantity: row.quantity,
              volume: volume,
              estimated_pallets: estimatedPallets,
              remaining_pallets: estimatedPallets, // 初始未约板数 = 预计板数
              delivery_nature: row.delivery_nature,
              delivery_location: locationMap.get(row.detail_delivery_location_code)!.toString(),
              fba: row.fba || null,
              notes: row.detail_notes || null,
              po: row.po || null,
              created_by: session.user.id ? BigInt(session.user.id) : null,
              updated_by: session.user.id ? BigInt(session.user.id) : null,
            }
          })
        }

        // 更新订单的整柜体积
        const totalVolume = rows.reduce((sum, row) => sum + row.volume, 0)
        await tx.orders.update({
          where: { order_id: order.order_id },
          data: { container_volume: totalVolume }
        })
      }
    })

    // 返回成功结果
    const result: ImportResult = {
      success: true,
      total: rawData.length,
      successCount: validRows.length,
      errorCount: 0,
      errors: [],
      createdOrderIds
    }

    console.log(`成功导入 ${createdOrderIds.length} 个订单，${validRows.length} 个明细`)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('导入订单失败:', error)
    return NextResponse.json(
      { 
        error: error.message || '导入订单失败',
        success: false,
        total: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ row: 0, message: error.message }]
      },
      { status: 500 }
    )
  }
}

