/**
 * 业务日期服务
 * 
 * 核心原则：系统永远不允许读取外部时间
 * 所有业务逻辑都从数据库的 system_config 表获取"当前业务日期"
 */

import prisma from '@/lib/prisma'
import { formatDateString } from '@/lib/utils/timezone'

/**
 * 获取当前业务日期
 * 从数据库的 system_config 表读取，而不是使用系统时间
 * 
 * @returns 当前业务日期字符串（YYYY-MM-DD）
 */
export async function getCurrentBusinessDate(): Promise<string> {
  try {
    const result = await prisma.$queryRaw<Array<{ business_date: Date }>>`
      SELECT public.get_current_business_date() as business_date
    `
    
    if (result.length === 0 || !result[0]?.business_date) {
      // 如果函数返回 null，尝试直接从配置表读取
      const config = await prisma.$queryRaw<Array<{ config_value: string }>>`
        SELECT config_value
        FROM public.system_config
        WHERE config_key = 'current_business_date'
      `
      
      if (config.length > 0 && config[0]?.config_value) {
        return formatDateString(config[0].config_value)
      }
      
      // 如果配置表中也没有数据，抛出错误（而不是使用系统时间）
      throw new Error('业务日期未配置，请先设置业务日期')
    }
    
    return formatDateString(result[0].business_date)
  } catch (error: any) {
    console.error('[业务日期服务] 获取业务日期失败:', error)
    throw new Error(`获取业务日期失败: ${error.message}`)
  }
}

/**
 * 更新业务日期
 * 通常由定时任务或管理员调用
 * 
 * @param dateString - 新的业务日期字符串（YYYY-MM-DD），如果不提供则使用数据库当前日期
 * @returns 更新后的业务日期字符串
 */
export async function updateBusinessDate(dateString?: string): Promise<string> {
  try {
    let result: Array<{ business_date: Date }>
    
    if (dateString) {
      // 如果提供了日期字符串，使用它
      const formattedDate = formatDateString(dateString)
      result = await prisma.$queryRaw<Array<{ business_date: Date }>>`
        SELECT public.update_business_date(${formattedDate}::DATE) as business_date
      `
    } else {
      // 如果没有提供，使用数据库当前日期
      result = await prisma.$queryRaw<Array<{ business_date: Date }>>`
        SELECT public.update_business_date() as business_date
      `
    }
    
    if (result.length === 0 || !result[0]?.business_date) {
      throw new Error('更新业务日期失败')
    }
    
    const updatedDate = formatDateString(result[0].business_date)
    console.log(`[业务日期服务] 业务日期已更新为: ${updatedDate}`)
    
    return updatedDate
  } catch (error: any) {
    console.error('[业务日期服务] 更新业务日期失败:', error)
    throw new Error(`更新业务日期失败: ${error.message}`)
  }
}

/**
 * 获取业务日期配置信息
 * 包括当前业务日期和最后更新时间
 * 
 * @returns 业务日期配置信息
 */
export async function getBusinessDateConfig(): Promise<{
  business_date: string
  updated_at: string | null
  updated_by: number | null
}> {
  try {
    const result = await prisma.$queryRaw<Array<{
      config_value: string
      updated_at: Date | null
      updated_by: bigint | null
    }>>`
      SELECT 
        config_value,
        updated_at,
        updated_by
      FROM public.system_config
      WHERE config_key = 'current_business_date'
    `
    
    if (result.length === 0) {
      throw new Error('业务日期配置不存在')
    }
    
    return {
      business_date: formatDateString(result[0].config_value),
      updated_at: result[0].updated_at ? result[0].updated_at.toISOString() : null,
      updated_by: result[0].updated_by ? Number(result[0].updated_by) : null,
    }
  } catch (error: any) {
    console.error('[业务日期服务] 获取业务日期配置失败:', error)
    throw new Error(`获取业务日期配置失败: ${error.message}`)
  }
}

