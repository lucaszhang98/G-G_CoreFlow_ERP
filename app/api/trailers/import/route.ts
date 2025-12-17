/**
 * 货柜批量导入 API
 * 
 * 职责：
 * 1. 权限检查
 * 2. 获取上传文件
 * 3. 调用Service处理业务逻辑
 * 4. 返回结果
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import { trailerImportService } from '@/lib/services/trailer-import.service'

export async function POST(request: NextRequest) {
  try {
    // 1. 权限检查
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const user = authResult.user
    if (!user || !['admin', 'tms_manager'].includes(user.role || '')) {
      return NextResponse.json(
        { error: '权限不足，只有管理员和TMS经理可以导入货柜' },
        { status: 403 }
      )
    }

    // 2. 获取上传的文件
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: '请选择要导入的Excel文件' },
        { status: 400 }
      )
    }

    // 3. 调用Service执行导入
    const result = await trailerImportService.import(file, BigInt(user.id))

    // 4. 返回结果
    if (result.success) {
      return NextResponse.json({
        ...result,
        successCount: result.imported,
        errorCount: 0,
        message: `成功导入 ${result.imported} 个货柜`,
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
    console.error('[货柜导入] 错误:', error)
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
