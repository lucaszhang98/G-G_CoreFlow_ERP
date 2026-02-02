/**
 * 提柜管理批量导入 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import { pickupManagementImportService } from '@/lib/services/pickup-management-import.service'

export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const user = authResult.user
    if (!user || !['admin', 'tms_manager'].includes(user.role || '')) {
      return NextResponse.json(
        { error: '权限不足，只有管理员和TMS经理可以导入提柜管理数据' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: '请选择要导入的Excel文件' },
        { status: 400 }
      )
    }

    const result = await pickupManagementImportService.import(file, BigInt(user.id))

    if (result.success) {
      return NextResponse.json({
        ...result,
        successCount: result.imported,
        errorCount: 0,
        message: `成功导入 ${result.imported} 条提柜管理数据`,
      })
    }

    return NextResponse.json({
      ...result,
      successCount: 0,
      errorCount: result.errors?.length || 0,
      message: `发现 ${result.errors?.length || 0} 个错误，请修正后重新导入`,
    })
  } catch (error: any) {
    console.error('[提柜管理导入] 错误:', error)
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
