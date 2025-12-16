/**
 * 货柜批量导入 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { trailerImportRowSchema, ImportError, ImportResult, TrailerImportRow } from '@/lib/validations/trailer-import'

export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const user = authResult.user
    if (!user || !['admin', 'tms_manager'].includes(user.role || '')) {
      return NextResponse.json(
        { error: '权限不足，只有管理员和TMS经理可以导入货柜' },
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

    const headers = jsonData[0] as string[]
    const dataRows = jsonData.slice(1) as any[][]

    const headerMap: Record<string, string> = {
      '货柜代码': 'trailer_code',
      '货柜类型': 'trailer_type',
      '长度(英尺)': 'length_feet',
      '载重(磅)': 'capacity_weight',
      '容量(立方英尺)': 'capacity_volume',
      '状态': 'status',
      '备注': 'notes',
    }

    const errors: ImportError[] = []
    const validRows: TrailerImportRow[] = []

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
        const validated = trailerImportRowSchema.parse(rowData)
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

    const codes = validRows.map(row => row.trailer_code)
    const duplicatesInFile = codes.filter((code, index) => codes.indexOf(code) !== index)
    
    if (duplicatesInFile.length > 0) {
      duplicatesInFile.forEach(code => {
        const rowNumbers = validRows
          .map((r, idx) => (r.trailer_code === code ? idx + 2 : -1))
          .filter(n => n > 0)
        errors.push({
          row: rowNumbers[0],
          field: 'trailer_code',
          message: `货柜代码 "${code}" 在文件中重复（行号：${rowNumbers.join(', ')}）`,
          value: code,
        })
      })

      return NextResponse.json({
        success: false,
        total: dataRows.length,
        successCount: 0,
        errorCount: errors.length,
        errors,
        message: `发现重复的货柜代码，请检查`,
      } as ImportResult)
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        const rowIndex = i + 2

        const existingTrailer = await tx.trailers.findUnique({
          where: { trailer_code: row.trailer_code },
        })

        if (existingTrailer) {
          throw new Error(`第${rowIndex}行：货柜代码 "${row.trailer_code}" 已存在，请使用不同的代码`)
        }

        await tx.trailers.create({
          data: {
            trailer_code: row.trailer_code,
            trailer_type: row.trailer_type,
            length_feet: row.length_feet,
            capacity_weight: row.capacity_weight,
            capacity_volume: row.capacity_volume,
            status: row.status || 'available',
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
      message: `成功导入 ${validRows.length} 个货柜`,
    } as ImportResult)

  } catch (error: any) {
    console.error('[货柜导入] 错误:', error)
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
