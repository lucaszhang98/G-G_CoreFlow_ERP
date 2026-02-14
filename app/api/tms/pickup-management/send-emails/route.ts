import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

// 承运公司到邮箱的映射
const CARRIER_EMAIL_MAP: Record<string, string> = {
  'NST': 'nextstopop1@gmail.com,nextstoptransportation888@gmail.com,nextstopop2@gmail.com',
  'CVT': 'conveytrucking56@gmail.com',
  'GG': 'info@hwhexpressinc.com',
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
            operation_mode: true,
            delivery_location: true,
            locations_orders_delivery_location_idTolocations: {
              select: { location_code: true },
            },
            delivery_appointments: {
              take: 1,
              orderBy: { appointment_id: 'asc' },
              include: {
                locations: { select: { location_code: true, name: true } },
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
      const destination =
        order.operation_mode === 'direct_delivery' && order.delivery_appointments?.[0]
          ? (order.delivery_appointments[0].locations?.location_code ?? order.delivery_appointments[0].locations?.name ?? '')
          : (order.locations_orders_delivery_location_idTolocations?.location_code || order.delivery_location || '')
      
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
    const resendIds: string[] = []

    // 优先使用 Resend API
    if (resendApiKey) {
      const resend = new Resend(resendApiKey)
      
      for (const email of emailData) {
        try {
          // Resend 支持多个收件人（用数组或逗号分隔的字符串）
          const toEmails = email.to.split(',').map((e: string) => e.trim())
          
          // 未配置 RESEND_FROM 时使用 Resend 提供的发件地址，无需验证域名（可发到任意收件人）
          const fromAddress = process.env.RESEND_FROM || process.env.EMAIL_FROM || 'ERP System <onboarding@resend.dev>'
          const result = await resend.emails.send({
            from: fromAddress,
            to: toEmails,
            cc: [email.cc],
            subject: email.subject,
            text: email.message,
          })
          if (process.env.NODE_ENV === 'development') {
            console.log('[发送邮件] Resend 原始响应:', JSON.stringify(result, null, 2))
          }
          const resendError = (result as { error?: { message?: string } })?.error
          if (resendError) {
            failedCount++
            const errorMsg = `柜号 ${email.containerNumber}: ${resendError.message || 'Resend 返回错误'}`
            errors.push(errorMsg)
            console.error(`[发送邮件] ❌ 发送失败 (Resend) - 柜号: ${email.containerNumber}:`, resendError.message)
          } else {
            const resendId = (result as { data?: { id?: string } })?.data?.id
            if (resendId) resendIds.push(resendId)
            sentCount++
            console.log(`[发送邮件] ✅ 成功发送邮件 (Resend) - 柜号: ${email.containerNumber}, 收件人: ${email.to}${resendId ? `, Resend ID: ${resendId}` : ''}`)
          }
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
                 '方式1 - Resend（无需域名）：\n' +
                 '1. 访问 https://resend.com 注册，获取 API Key\n' +
                 '2. 在 .env 或 .env.local 中添加: RESEND_API_KEY=你的API密钥\n' +
                 '3. 不设 RESEND_FROM 即使用 Resend 默认发件地址（无需验证域名）\n\n' +
                 '方式2 - Gmail SMTP（无需域名）：\n' +
                 '在 .env 中添加: SMTP_USER=你的Gmail, SMTP_PASS=Gmail应用专用密码',
          email_data: process.env.NODE_ENV === 'development' ? emailData : undefined,
        },
        { status: 500 }
      )
    }

    const usingOnboardingFrom = !process.env.RESEND_FROM && !process.env.EMAIL_FROM
    return NextResponse.json({
      success: true,
      message: failedCount === 0 
        ? `成功发送 ${sentCount} 封邮件`
        : `成功发送 ${sentCount} 封邮件，${failedCount} 封失败`,
      sent_count: sentCount,
      failed_count: failedCount,
      errors: errors.length > 0 ? errors : undefined,
      resend_ids: resendIds.length > 0 ? resendIds : undefined,
      resend_no_domain_hint: usingOnboardingFrom && sentCount > 0
        ? '当前使用 Resend 默认发件人(未验证域名)，Resend 可能不会投递到真实邮箱。若收不到请改用 Gmail：在 .env 中设置 SMTP_USER 与 SMTP_PASS（Gmail 应用专用密码），并去掉 RESEND_API_KEY 即可用 Gmail 发送。'
        : undefined,
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

