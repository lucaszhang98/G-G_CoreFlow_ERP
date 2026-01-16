import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

// 承运公司到邮箱的映射
const CARRIER_EMAIL_MAP: Record<string, string> = {
  'NST': 'nextstopop1@gmail.com,nextstoptransportation888@gmail.com,nextstopop2@gmail.com,zhang.yuxuan5@northeastern.edu',
  'CVT': 'conveytrucking56@gmail.com,zhang.yuxuan5@northeastern.edu',
  'GG': 'zhang.yuxuan5@northeastern.edu',
}

// 固定抄送邮箱
const CC_EMAIL = 'info@hwhexpressinc.com'

// 格式化日期为 MM/DD 格式
function formatDate(date: Date | string | null): string {
  if (!date) return ''
  
  let d: Date
  if (typeof date === 'string') {
    d = new Date(date)
  } else {
    d = date
  }
  
  if (isNaN(d.getTime())) return ''
  
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}/${day}`
}

// POST - 批量发送邮件
export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { pickup_ids } = body

    if (!pickup_ids || !Array.isArray(pickup_ids) || pickup_ids.length === 0) {
      return NextResponse.json(
        { error: '请提供要发送邮件的提柜管理记录ID列表' },
        { status: 400 }
      )
    }

    // 查询选中的提柜管理记录及其关联的订单信息
    const pickups = await prisma.pickup_management.findMany({
      where: {
        pickup_id: {
          in: pickup_ids.map((id: string) => BigInt(id)),
        },
      },
      include: {
        orders: {
          select: {
            order_id: true,
            order_number: true,
            mbl_number: true,
            eta_date: true,
            delivery_location: true,
            locations_orders_delivery_location_idTolocations: {
              select: {
                location_code: true,
              },
            },
            carriers: {
              select: {
                carrier_id: true,
                name: true,
                carrier_code: true,
              },
            },
          },
        },
      },
    })

    if (pickups.length === 0) {
      return NextResponse.json(
        { error: '未找到对应的提柜管理记录' },
        { status: 404 }
      )
    }

    // 准备邮件数据
    const emailData: Array<{
      to: string
      cc: string
      subject: string
      message: string
      containerNumber: string
    }> = []

    for (const pickup of pickups) {
      const order = pickup.orders
      if (!order) continue

      // 提取字段
      const containerMbl = order.mbl_number || ''
      const containerNumber = order.order_number || ''
      const etaDate = formatDate(order.eta_date)
      const destination = order.locations_orders_delivery_location_idTolocations?.location_code || order.delivery_location || ''
      
      // 获取承运公司名称或代码（转换为大写以便匹配）
      const carrierName = (order.carriers?.name || '').toUpperCase().trim()
      const carrierCode = (order.carriers?.carrier_code || '').toUpperCase().trim()
      
      // 根据承运公司确定收件人邮箱
      // 优先使用 carrier_code，如果没有则使用 name
      const carrierKey = carrierCode || carrierName
      const emailAddress = CARRIER_EMAIL_MAP[carrierKey]
      
      // 如果承运公司不在映射中，跳过
      if (!emailAddress) {
        console.warn(`[发送邮件] 承运公司 "${carrierKey}" (原始: ${order.carriers?.carrier_code || order.carriers?.name || 'N/A'}) 不在映射中，跳过记录 pickup_id: ${pickup.pickup_id}, 柜号: ${containerNumber}`)
        continue
      }

      // 构建邮件内容
      const subject = `Container Information Report for ${containerNumber}`
      const message = `Information reporting for container number:  ${containerNumber}:\n\n` +
                      `MBL: ${containerMbl}\n` +
                      `ETA日期: ${etaDate}\n` +
                      `送柜地址：${destination}\n` +
                      `DO后补`

      emailData.push({
        to: emailAddress,
        cc: CC_EMAIL,
        subject,
        message,
        containerNumber,
      })
    }

    if (emailData.length === 0) {
      return NextResponse.json(
        { error: '没有符合条件的记录需要发送邮件（承运公司不在映射中）' },
        { status: 400 }
      )
    }

    // 检查邮件配置 - 优先使用 Resend API（更简单，不需要应用专用密码）
    const resendApiKey = process.env.RESEND_API_KEY
    
    // 如果没有 Resend API Key，尝试使用 SMTP（需要应用专用密码）
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS
    
    let sentCount = 0
    let failedCount = 0
    const errors: string[] = []

    // 优先使用 Resend API
    if (resendApiKey) {
      const resend = new Resend(resendApiKey)
      
      for (const email of emailData) {
        try {
          // Resend 支持多个收件人（用数组或逗号分隔的字符串）
          const toEmails = email.to.split(',').map((e: string) => e.trim())
          
          await resend.emails.send({
            from: process.env.RESEND_FROM || process.env.EMAIL_FROM || 'ERP System <noreply@ggtransport.in>',
            to: toEmails,
            cc: [email.cc],
            subject: email.subject,
            text: email.message,
          })
          
          sentCount++
          console.log(`[发送邮件] ✅ 成功发送邮件 (Resend) - 柜号: ${email.containerNumber}, 收件人: ${email.to}`)
        } catch (error: any) {
          failedCount++
          const errorMsg = `柜号 ${email.containerNumber}: ${error.message || '发送失败'}`
          errors.push(errorMsg)
          console.error(`[发送邮件] ❌ 发送失败 (Resend) - 柜号: ${email.containerNumber}:`, error)
        }
      }
    } 
    // 回退到 SMTP（如果配置了）
    else if (smtpUser && smtpPass) {
      const smtpHost = process.env.SMTP_HOST
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined
      const smtpSecure = process.env.SMTP_SECURE === 'true'
      const smtpService = process.env.SMTP_SERVICE

      // 配置邮件传输器
      const transporterConfig: any = {
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      }

      if (smtpService) {
        transporterConfig.service = smtpService
      } else if (smtpHost) {
        transporterConfig.host = smtpHost
        if (smtpPort) {
          transporterConfig.port = smtpPort
        }
        if (smtpSecure !== undefined) {
          transporterConfig.secure = smtpSecure
        }
      } else {
        transporterConfig.service = 'gmail'
      }

      const transporter = nodemailer.createTransport(transporterConfig)

      // 验证连接
      try {
        await transporter.verify()
        console.log('[发送邮件] SMTP 服务器连接验证成功')
      } catch (error: any) {
        console.error('[发送邮件] SMTP 服务器连接验证失败:', error)
        return NextResponse.json(
          {
            error: `SMTP 服务器连接失败: ${error.message || '未知错误'}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          },
          { status: 500 }
        )
      }

      // 发送邮件
      for (const email of emailData) {
        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser,
            to: email.to,
            cc: email.cc,
            subject: email.subject,
            text: email.message,
          })
          sentCount++
          console.log(`[发送邮件] ✅ 成功发送邮件 (SMTP) - 柜号: ${email.containerNumber}, 收件人: ${email.to}`)
        } catch (error: any) {
          failedCount++
          const errorMsg = `柜号 ${email.containerNumber}: ${error.message || '发送失败'}`
          errors.push(errorMsg)
          console.error(`[发送邮件] ❌ 发送失败 (SMTP) - 柜号: ${email.containerNumber}:`, error)
        }
      }
    } 
    // 都没有配置
    else {
      return NextResponse.json(
        {
          error: '邮件服务未配置。请选择以下方式之一：\n\n' +
                 '方式1（推荐 - 无需应用专用密码）：\n' +
                 '1. 访问 https://resend.com 注册账号（免费）\n' +
                 '2. 获取 API Key\n' +
                 '3. 在 .env.local 中添加: RESEND_API_KEY=你的API密钥\n' +
                 '4. 可选: RESEND_FROM=ERP System <noreply@ggtransport.in>\n\n' +
                 '方式2（需要应用专用密码）：\n' +
                 '在 .env.local 中添加: SMTP_USER=你的邮箱, SMTP_PASS=应用专用密码',
          email_data: process.env.NODE_ENV === 'development' ? emailData : undefined,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: failedCount === 0 
        ? `成功发送 ${sentCount} 封邮件`
        : `成功发送 ${sentCount} 封邮件，${failedCount} 封失败`,
      sent_count: sentCount,
      failed_count: failedCount,
      errors: errors.length > 0 ? errors : undefined,
      email_data: process.env.NODE_ENV === 'development' ? emailData : undefined, // 仅开发环境返回邮件数据用于调试
    })
  } catch (error: any) {
    console.error('批量发送邮件失败:', error)
    return NextResponse.json(
      {
        error: error.message || '批量发送邮件失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

