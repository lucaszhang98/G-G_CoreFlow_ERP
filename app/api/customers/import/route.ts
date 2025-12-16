/**
 * 客户批量导入 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { customerImportRowSchema, ImportError, ImportResult, CustomerImportRow } from '@/lib/validations/customer-import'

export async function POST(request: NextRequest) {
  try {
    // 1. 权限检查
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const user = authResult.user
    if (!user || !['admin', 'oms_manager'].includes(user.role || '')) {
      return NextResponse.json(
        { error: '权限不足，只有管理员和OMS经理可以导入客户' },
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

    // 表头映射（包含联系人字段）
    const headerMap: Record<string, string> = {
      '客户代码': 'code',
      '客户名称': 'name',
      '公司名称': 'company_name',
      '状态': 'status',
      '信用额度': 'credit_limit',
      '联系人姓名': 'contact_name',
      '联系人电话': 'contact_phone',
      '联系人邮箱': 'contact_email',
      '联系人地址行1': 'contact_address_line1',
      '联系人地址行2': 'contact_address_line2',
      '联系人城市': 'contact_city',
      '联系人州/省': 'contact_state',
      '联系人邮政编码': 'contact_postal_code',
      '联系人国家': 'contact_country',
    }

    // 5. 验证和转换数据
    const errors: ImportError[] = []
    const validRows: CustomerImportRow[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const rowIndex = i + 2 // Excel行号（从1开始，且跳过表头）
      const row = dataRows[i]
      
      // 跳过空行
      if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
        continue
      }

      // 构建行对象
      const rowData: Record<string, any> = {}
      headers.forEach((header, index) => {
        const fieldKey = headerMap[header]
        if (fieldKey) {
          rowData[fieldKey] = row[index]
        }
      })

      // Zod验证
      try {
        const validated = customerImportRowSchema.parse(rowData)
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

    // 6. 如果有验证错误，返回错误信息（不执行导入）
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

    // 7. 检查客户代码唯一性
    const codes = validRows.map(row => row.code)
    const duplicatesInFile = codes.filter((code, index) => codes.indexOf(code) !== index)
    
    if (duplicatesInFile.length > 0) {
      duplicatesInFile.forEach(code => {
        const rowNumbers = validRows
          .map((r, idx) => (r.code === code ? idx + 2 : -1))
          .filter(n => n > 0)
        errors.push({
          row: rowNumbers[0],
          field: 'code',
          message: `客户代码 "${code}" 在文件中重复（行号：${rowNumbers.join(', ')}）`,
          value: code,
        })
      })

      return NextResponse.json({
        success: false,
        total: dataRows.length,
        successCount: 0,
        errorCount: errors.length,
        errors,
        message: `发现重复的客户代码，请检查`,
      } as ImportResult)
    }

    // 8. 使用事务批量导入（全部成功或全部失败）
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        const rowIndex = i + 2

        // 检查客户代码是否已存在
        const existingCustomer = await tx.customers.findUnique({
          where: { code: row.code },
        })

        if (existingCustomer) {
          throw new Error(`第${rowIndex}行：客户代码 "${row.code}" 已存在，请使用不同的代码`)
        }

        // 创建客户（如果有联系人信息，先创建联系人）
        let contactId: bigint | undefined
        
        if (row.contact_name || row.contact_phone || row.contact_email) {
          const contact = await tx.contact_roles.create({
            data: {
              related_entity_type: 'customer',
              related_entity_id: BigInt(0), // 临时值，后续更新
              role: 'primary',
              name: row.contact_name || '未命名联系人',
              phone: row.contact_phone,
              email: row.contact_email,
              address_line1: row.contact_address_line1,
              address_line2: row.contact_address_line2,
              city: row.contact_city,
              state: row.contact_state,
              postal_code: row.contact_postal_code,
              country: row.contact_country,
              is_primary: true,
              created_by: user.id ? BigInt(user.id) : undefined,
              updated_by: user.id ? BigInt(user.id) : undefined,
            },
          })
          contactId = contact.contact_id
        }
        
        // 创建客户
        const customer = await tx.customers.create({
          data: {
            code: row.code,
            name: row.name,
            company_name: row.company_name,
            status: row.status || 'active',
            credit_limit: row.credit_limit || 0,
            contact_id: contactId,
            created_by: user.id ? BigInt(user.id) : undefined,
            updated_by: user.id ? BigInt(user.id) : undefined,
          },
        })
        
        // 更新联系人的 related_entity_id
        if (contactId) {
          await tx.contact_roles.update({
            where: { contact_id: contactId },
            data: { related_entity_id: customer.id },
          })
        }
      }
    })

    // 9. 返回成功结果
    return NextResponse.json({
      success: true,
      total: validRows.length,
      successCount: validRows.length,
      errorCount: 0,
      errors: [],
      message: `成功导入 ${validRows.length} 个客户`,
    } as ImportResult)

  } catch (error: any) {
    console.error('[客户导入] 错误:', error)
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
