import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { orderImportService } from '@/lib/services/order-import.service'

/**
 * 订单批量导入 API
 * 
 * 职责：
 * 1. 权限检查
 * 2. 获取上传文件
 * 3. 调用Service处理业务逻辑
 * 4. 返回结果
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 权限检查
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    if (!['admin', 'oms_manager'].includes(session.user.role || '')) {
      return NextResponse.json({ error: '无权限导入订单' }, { status: 403 })
    }

    // 2. 获取上传的文件
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '未上传文件' }, { status: 400 })
    }

    // 3. 调用Service执行导入
    const result = await orderImportService.import(file, BigInt(session.user.id))

    // 4. 返回结果
    if (result.success) {
      return NextResponse.json({
        ...result,
        successCount: result.imported,
        errorCount: 0,
        message: `成功导入 ${result.imported} 个订单明细`,
      })
    } else {
      return NextResponse.json({
        ...result,
        successCount: 0,
        errorCount: result.errors?.length || 0,
        message: `发现 ${result.errors?.length || 0} 个错误，请修正后重新导入`,
      })
    }
  } catch (error: any) {
    console.error('[订单导入] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        total: 0,
        successCount: 0,
        errorCount: 1,
        errors: [
          {
            row: 0,
            field: 'system',
            message: error.message || '导入失败',
          },
        ],
        message: error.message || '导入失败，请检查数据格式',
      },
      { status: 500 }
    )
  }
}

