/**
 * 修复预约管理中送货时间的分钟数为59的问题
 * 如果分钟数是59，就将小时数加1，分钟数改为00
 * 例如：07:59 -> 08:00
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma'

// 加载环境变量
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

/**
 * 修复时间：如果分钟数是59，就加1小时，分钟数改为00
 */
function fixTimeIfNeeded(date: Date | null): Date | null {
  if (!date) return null
  
  // 使用UTC方法获取时间组件，避免时区转换
  const minutes = date.getUTCMinutes()
  
  // 如果分钟数不是59，不需要修复
  if (minutes !== 59) return date
  
  // 如果分钟数是59，加1小时，分钟数改为00
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const hours = date.getUTCHours()
  
  // 创建新的时间：小时数+1，分钟数、秒数、毫秒数都设为0
  const fixedDate = new Date(Date.UTC(
    year,
    month,
    day,
    hours + 1, // 小时数加1
    0, // 分钟数设为0
    0, // 秒数设为0
    0  // 毫秒数设为0
  ))
  
  return fixedDate
}

/**
 * 格式化时间用于显示
 */
function formatTime(date: Date | null): string {
  if (!date) return 'null'
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

async function main() {
  console.log('开始检查并修复预约管理中的送货时间...\n')
  
  try {
    // 查询所有预约记录
    const appointments = await prisma.delivery_appointments.findMany({
      select: {
        appointment_id: true,
        reference_number: true,
        confirmed_start: true,
        confirmed_end: true,
      },
      orderBy: {
        appointment_id: 'asc',
      },
    })
    
    console.log(`找到 ${appointments.length} 条预约记录\n`)
    
    let fixedCount = 0
    const updates: Array<{
      appointment_id: bigint
      reference_number: string | null
      field: 'confirmed_start' | 'confirmed_end'
      oldTime: Date
      newTime: Date
    }> = []
    
    // 检查每条记录
    for (const appointment of appointments) {
      let needsUpdate = false
      const updateData: {
        confirmed_start?: Date | null
        confirmed_end?: Date | null
      } = {}
      
      // 检查 confirmed_start
      if (appointment.confirmed_start) {
        const fixedStart = fixTimeIfNeeded(appointment.confirmed_start)
        if (fixedStart && fixedStart.getTime() !== appointment.confirmed_start.getTime()) {
          updateData.confirmed_start = fixedStart
          needsUpdate = true
          updates.push({
            appointment_id: appointment.appointment_id,
            reference_number: appointment.reference_number,
            field: 'confirmed_start',
            oldTime: appointment.confirmed_start,
            newTime: fixedStart,
          })
        }
      }
      
      // 检查 confirmed_end
      if (appointment.confirmed_end) {
        const fixedEnd = fixTimeIfNeeded(appointment.confirmed_end)
        if (fixedEnd && fixedEnd.getTime() !== appointment.confirmed_end.getTime()) {
          updateData.confirmed_end = fixedEnd
          needsUpdate = true
          updates.push({
            appointment_id: appointment.appointment_id,
            reference_number: appointment.reference_number,
            field: 'confirmed_end',
            oldTime: appointment.confirmed_end,
            newTime: fixedEnd,
          })
        }
      }
      
      // 如果需要更新，执行更新
      if (needsUpdate) {
        await prisma.delivery_appointments.update({
          where: {
            appointment_id: appointment.appointment_id,
          },
          data: updateData,
        })
        fixedCount++
      }
    }
    
    // 输出修复结果
    console.log(`\n修复完成！`)
    console.log(`总共检查了 ${appointments.length} 条记录`)
    console.log(`修复了 ${fixedCount} 条记录`)
    console.log(`共修复了 ${updates.length} 个时间字段\n`)
    
    if (updates.length > 0) {
      console.log('修复详情：')
      console.log('='.repeat(80))
      for (const update of updates) {
        console.log(`预约ID: ${update.appointment_id}`)
        console.log(`  预约号码: ${update.reference_number || 'N/A'}`)
        console.log(`  字段: ${update.field}`)
        console.log(`  原时间: ${formatTime(update.oldTime)}`)
        console.log(`  新时间: ${formatTime(update.newTime)}`)
        console.log('')
      }
    } else {
      console.log('没有发现需要修复的时间（所有时间的分钟数都不是59）')
    }
    
  } catch (error) {
    console.error('修复过程中发生错误:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
