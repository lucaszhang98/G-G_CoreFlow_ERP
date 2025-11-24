import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

// PATCH - 更新海柜数据（更新orders表的字段）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const resolvedParams = params instanceof Promise ? await params : params
    const containerId = resolvedParams.id

    if (!containerId || isNaN(Number(containerId))) {
      return NextResponse.json({ error: '无效的容器ID' }, { status: 400 })
    }

    const body = await request.json()
    const { field, value, order_id } = body

    if (!field || !order_id) {
      return NextResponse.json({ error: '缺少必要参数: field 和 order_id 是必需的' }, { status: 400 })
    }

    // 验证订单ID格式
    let orderIdBigInt: bigint
    try {
      orderIdBigInt = BigInt(order_id)
    } catch (e) {
      return NextResponse.json({ error: '无效的订单ID格式' }, { status: 400 })
    }

    // 先验证订单是否存在
    const order = await prisma.orders.findUnique({
      where: { order_id: orderIdBigInt },
      select: { order_id: true },
    })

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    // 可编辑的字段映射（前端字段名 -> 数据库字段名）
    const fieldMap: Record<string, string> = {
      'eta_date': 'eta_date',
      'lfd_date': 'lfd_date',
      'pickup_date': 'pickup_date',
      'return_date': 'return_deadline',
      'port_location': 'port_location',
      'operation_mode': 'operation_mode',
      'delivery_location': 'delivery_location',
    }

    const dbField = fieldMap[field]
    if (!dbField) {
      return NextResponse.json({ 
        error: `字段 ${field} 不允许编辑`,
        allowedFields: Object.keys(fieldMap)
      }, { status: 400 })
    }

    // 构建更新数据对象
    // 使用 Prisma 期望的类型，但允许动态字段访问
    const updateData: Record<string, any> = {}

    // 根据字段类型处理值
    if (dbField === 'do_issued') {
      // 布尔字段
      updateData[dbField] = value === true || value === 'true' || value === '1' || value === 1
    } else if (dbField === 'appointment_time') {
      // 预约时间字段 (TIMESTAMPTZ)
      if (value === null || value === undefined || value === '') {
        updateData[dbField] = null
      } else {
        try {
          const dateTimeStr = String(value).trim()
          if (!dateTimeStr) {
            updateData[dbField] = null
          } else {
            // 直接解析日期时间字符串
            const date = new Date(dateTimeStr)
            if (isNaN(date.getTime())) {
              console.error('无效的日期时间格式:', value)
              return NextResponse.json({ error: `无效的日期时间格式: ${value}` }, { status: 400 })
            }
            updateData[dbField] = date
          }
        } catch (e: any) {
          console.error('解析预约时间失败:', e, value)
          return NextResponse.json({ error: `解析预约时间失败: ${String(e)}` }, { status: 400 })
        }
      }
    } else if (dbField.includes('date') && dbField !== 'appointment_time') {
      // 日期字段（DATE 类型，不包含时间）
      // 简单处理：输入什么日期就存什么日期，使用 UTC 日期（年月日），时间设为 00:00:00
      if (value === null || value === undefined || value === '') {
        updateData[dbField] = null
      } else {
        try {
          const dateStr = String(value).trim()
          if (!dateStr) {
            updateData[dbField] = null
          } else {
            // 验证日期格式 (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/
            if (!dateRegex.test(dateStr)) {
              return NextResponse.json({ error: `无效的日期格式: ${value}，期望格式: YYYY-MM-DD` }, { status: 400 })
            }
            
            // 解析日期部分（年、月、日）
            const [year, month, day] = dateStr.split('-').map(Number)
            
            // 验证日期有效性
            const testDate = new Date(year, month - 1, day)
            if (
              testDate.getFullYear() !== year ||
              testDate.getMonth() !== month - 1 ||
              testDate.getDate() !== day
            ) {
              return NextResponse.json({ error: `无效的日期值: ${value}` }, { status: 400 })
            }
            
            // 直接使用 UTC 日期，时间设为 00:00:00
            // 这样存储的就是输入的日期，不进行任何时区转换
            const dateOnly = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
            updateData[dbField] = dateOnly
          }
        } catch (e: any) {
          console.error(`解析日期字段 ${dbField} 失败:`, e, value)
          return NextResponse.json({ error: `解析日期失败: ${String(e)}` }, { status: 400 })
        }
      }
    } else {
      // 字符串字段 (port_location, operation_mode, delivery_location)
      if (value === null || value === undefined) {
        updateData[dbField] = null
      } else {
        const strValue = String(value).trim()
        updateData[dbField] = strValue || null
      }
    }

    // 执行更新
    // 如果 updateData 为空，不执行更新
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 })
    }

    // 添加调试日志
    const logUpdateData: Record<string, any> = {}
    for (const [key, val] of Object.entries(updateData)) {
      if (val instanceof Date) {
        // 对于日期字段，显示本地日期和 UTC 日期
        if (key.includes('date') && key !== 'appointment_time') {
          // DATE 类型字段，显示日期部分
          logUpdateData[key] = {
            type: 'Date',
            local: val.toLocaleDateString('zh-CN'),
            utc: val.toISOString().split('T')[0],
            iso: val.toISOString(),
            timestamp: val.getTime(),
          }
        } else {
          // TIMESTAMPTZ 类型字段
          logUpdateData[key] = {
            type: 'Date',
            local: val.toLocaleString('zh-CN'),
            iso: val.toISOString(),
            timestamp: val.getTime(),
          }
        }
      } else {
        logUpdateData[key] = {
          type: typeof val,
          value: val,
        }
      }
    }
    
    console.log('更新数据:', {
      order_id: orderIdBigInt.toString(),
      field: dbField,
      originalValue: value,
      originalValueType: typeof value,
      updateData: logUpdateData,
      // 验证 updateData 中的 Date 对象
      dateObjects: Object.entries(updateData)
        .filter(([_, v]) => v instanceof Date)
        .map(([k, v]) => ({ key: k, date: v, iso: v.toISOString() })),
    })

    // 确保所有 Date 对象都是有效的
    for (const [key, val] of Object.entries(updateData)) {
      if (val instanceof Date && isNaN(val.getTime())) {
        console.error(`无效的日期对象在字段 ${key}:`, val)
        return NextResponse.json({ error: `无效的日期值: ${key}` }, { status: 400 })
      }
    }

    const updatedOrder = await prisma.orders.update({
      where: { order_id: orderIdBigInt },
      data: updateData,
    })

    // 序列化返回数据
    const serialized = serializeBigInt({
      order_id: updatedOrder.order_id.toString(),
      [dbField]: updatedOrder[dbField as keyof typeof updatedOrder],
    })

    return NextResponse.json({ 
      success: true,
      message: '更新成功',
      data: serialized
    })
  } catch (error: any) {
    console.error('更新海柜数据失败:', error)
    console.error('错误详情:', {
      code: error.code,
      meta: error.meta,
      message: error.message,
      stack: error.stack,
    })
    
    // 处理 Prisma 特定错误
    if (error.code === 'P2025') {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }
    
    if (error.code === 'P2002') {
      return NextResponse.json({ error: '数据冲突，请刷新后重试' }, { status: 409 })
    }

    if (error.code === 'P2003') {
      return NextResponse.json({ error: '关联数据不存在' }, { status: 400 })
    }
    
    return NextResponse.json(
      { 
        error: error.message || '更新失败',
        code: error.code || 'UNKNOWN_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
