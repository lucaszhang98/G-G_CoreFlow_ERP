/**
 * 位置批量导入 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { locationImportRowSchema, ImportError, ImportResult, LocationImportRow } from '@/lib/validations/location-import'

export async function POST(request: NextRequest) {
  try {
    // 1. 权限检查
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const user = authResult.user
    if (!user || !['admin', 'oms_manager', 'tms_manager', 'wms_manager'].includes(user.role || '')) {
      return NextResponse.json(
        { error: '权限不足，只有管理员和经理可以导入位置' },
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

    // 3. 读取Excel文件
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    if (jsonData.length < 2) {
      return NextResponse.json(
        { error: 'Excel文件中没有数据行' },
        { status: 400 }
      )
    }

    // 4. 解析表头和数据
    const headers = jsonData[0] as string[]
    const dataRows = jsonData.slice(1) as any[][]

    // 表头映射
    const headerMap: Record<string, string> = {
      '位置代码': 'location_code',
      '位置名称': 'name',
      '位置类型': 'location_type',
      '地址行1': 'address_line1',
      '地址行2': 'address_line2',
      '城市': 'city',
      '州/省': 'state',
      '邮政编码': 'postal_code',
      '国家': 'country',
      '备注': 'notes',
    }

    // 5. 验证和转换数据
    const errors: ImportError[] = []
    const validRows: LocationImportRow[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const rowIndex = i + 2
      const row = dataRows[i]
      
      if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
        continue
      }

      const rowData: Record<string, any> = {}
      headers.forEach((header, index) => {
        const fieldKey = headerMap[header]
        if (fieldKey) {
          rowData[fieldKey] = row[index]
        }
      })

      try {
        const validated = locationImportRowSchema.parse(rowData)
        validRows.push(validated)
      } catch (error: any) {
        if (error.errors) {
          error.errors.forEach((err: any) => {
            errors.push({
              row: rowIndex,
              field: err.path.join('.'),
              message: err.message,
              value: rowData[err.path[0]],
            })
          })
        } else {
          errors.push({
            row: rowIndex,
            message: error.message || '数据验证失败',
          })
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        total: dataRows.length,
        successCount: 0,
        errorCount: errors.length,
        errors,
        message: `发现 ${errors.length} 个错误，请修正后重新导入`,
      } as ImportResult)
    }

    // 6. 检查位置代码唯一性
    const codes = validRows.map(row => row.location_code)
    const duplicatesInFile = codes.filter((code, index) => codes.indexOf(code) !== index)
    
    if (duplicatesInFile.length > 0) {
      duplicatesInFile.forEach(code => {
        const rowNumbers = validRows
          .map((r, idx) => (r.location_code === code ? idx + 2 : -1))
          .filter(n => n > 0)
        errors.push({
          row: rowNumbers[0],
          field: 'location_code',
          message: `位置代码 "${code}" 在文件中重复（行号：${rowNumbers.join(', ')}）`,
          value: code,
        })
      })

      return NextResponse.json({
        success: false,
        total: dataRows.length,
        successCount: 0,
        errorCount: errors.length,
        errors,
        message: `发现重复的位置代码，请检查`,
      } as ImportResult)
    }

    // 7. 使用事务批量导入
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        const rowIndex = i + 2

        const existingLocation = await tx.locations.findUnique({
          where: { location_code: row.location_code },
        })

        if (existingLocation) {
          throw new Error(`第${rowIndex}行：位置代码 "${row.location_code}" 已存在，请使用不同的代码`)
        }

        await tx.locations.create({
          data: {
            location_code: row.location_code,
            name: row.name,
            location_type: row.location_type,
            address_line1: row.address_line1,
            address_line2: row.address_line2,
            city: row.city,
            state: row.state,
            postal_code: row.postal_code,
            country: row.country,
            notes: row.notes,
            created_by: user.id ? BigInt(user.id) : undefined,
            updated_by: user.id ? BigInt(user.id) : undefined,
          },
        })
      }
    })

    return NextResponse.json({
      success: true,
      total: validRows.length,
      successCount: validRows.length,
      errorCount: 0,
      errors: [],
      message: `成功导入 ${validRows.length} 个位置`,
    } as ImportResult)

  } catch (error: any) {
    console.error('[位置导入] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        total: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{
          row: 0,
          message: error.message || '导入失败',
        }],
        message: error.message || '导入失败，请检查数据格式',
      } as ImportResult,
      { status: 500 }
    )
  }
}
