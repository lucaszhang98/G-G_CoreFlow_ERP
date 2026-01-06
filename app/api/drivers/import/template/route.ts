/**
 * 司机导入模板下载 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import { generateDriverImportTemplate } from '@/lib/utils/driver-excel-template'

export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const user = authResult.user
    if (!user || !['admin', 'tms_manager'].includes(user.role || '')) {
      return NextResponse.json(
        { error: '权限不足，只有管理员和TMS经理可以下载模板' },
        { status: 403 }
      )
    }

    // 生成模板
    const workbook = await generateDriverImportTemplate()
    const buffer = await workbook.xlsx.writeBuffer()

    // 返回文件
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="司机导入模板.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('[司机导入模板] 错误:', error)
    return NextResponse.json(
      { error: error.message || '生成模板失败' },
      { status: 500 }
    )
  }
}

