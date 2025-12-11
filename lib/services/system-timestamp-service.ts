/**
 * 系统时间戳服务
 * 
 * 核心原则：系统永远不允许读取外部时间
 * 所有业务逻辑都从数据库的 system_config 表获取"当前系统时间戳"
 * 
 * 时间戳更新方式：
 * - 定时任务定期更新（如每30分钟），在原有时间基础上增加时间间隔
 * - 不进行时区转换，按照系统约定的时区理解（PST/PDT）
 */

import prisma from '@/lib/prisma'

/**
 * 获取系统当前时间戳
 * 从数据库的 system_config 表读取，而不是使用系统时间
 * 
 * @returns 当前系统时间戳（Date 对象）
 */
export async function getCurrentSystemTimestamp(): Promise<Date> {
  try {
    const result = await prisma.$queryRaw<Array<{ system_timestamp: Date }>>`
      SELECT public.get_current_system_timestamp() as system_timestamp
    `
    
    if (result.length === 0 || !result[0]?.system_timestamp) {
      // 如果函数返回 null，尝试直接从配置表读取
      const config = await prisma.$queryRaw<Array<{ config_value: string }>>`
        SELECT config_value
        FROM public.system_config
        WHERE config_key = 'current_system_timestamp'
      `
      
      if (config.length > 0 && config[0]?.config_value) {
        return new Date(config[0].config_value)
      }
      
      // 如果配置表中也没有数据，抛出错误（而不是使用系统时间）
      throw new Error('系统时间戳未配置，请先设置系统时间戳')
    }
    
    return result[0].system_timestamp
  } catch (error: any) {
    console.error('[系统时间戳服务] 获取系统时间戳失败:', error)
    throw new Error(`获取系统时间戳失败: ${error.message}`)
  }
}

/**
 * 更新系统时间戳（在原有时间基础上增加指定时间间隔）
 * 通常由定时任务调用
 * 
 * @param intervalMinutes - 要增加的时间间隔（分钟），默认 30 分钟
 * @returns 更新后的系统时间戳
 */
export async function updateSystemTimestamp(intervalMinutes: number = 30): Promise<Date> {
  try {
    const interval = `${intervalMinutes} minutes`
    
    const result = await prisma.$queryRaw<Array<{ system_timestamp: Date }>>`
      SELECT public.update_system_timestamp(${interval}::INTERVAL) as system_timestamp
    `
    
    if (result.length === 0 || !result[0]?.system_timestamp) {
      throw new Error('更新系统时间戳失败')
    }
    
    const updatedTimestamp = result[0].system_timestamp
    console.log(`[系统时间戳服务] 系统时间戳已更新为: ${updatedTimestamp.toISOString()}`)
    
    return updatedTimestamp
  } catch (error: any) {
    console.error('[系统时间戳服务] 更新系统时间戳失败:', error)
    throw new Error(`更新系统时间戳失败: ${error.message}`)
  }
}

/**
 * 设置系统时间戳（用于初始设置或手动调整）
 * 
 * @param timestampString - 新的时间戳字符串（ISO 格式），如果不提供则使用数据库当前时间
 * @returns 设置后的系统时间戳
 */
export async function setSystemTimestamp(timestampString?: string): Promise<Date> {
  try {
    let result: Array<{ system_timestamp: Date }>
    
    if (timestampString) {
      // 如果提供了时间戳字符串，使用它
      const timestamp = new Date(timestampString)
      if (isNaN(timestamp.getTime())) {
        throw new Error('无效的时间戳格式')
      }
      
      result = await prisma.$queryRaw<Array<{ system_timestamp: Date }>>`
        SELECT public.set_system_timestamp(${timestamp}::TIMESTAMPTZ) as system_timestamp
      `
    } else {
      // 如果没有提供，使用数据库当前时间
      result = await prisma.$queryRaw<Array<{ system_timestamp: Date }>>`
        SELECT public.set_system_timestamp() as system_timestamp
      `
    }
    
    if (result.length === 0 || !result[0]?.system_timestamp) {
      throw new Error('设置系统时间戳失败')
    }
    
    const setTimestamp = result[0].system_timestamp
    console.log(`[系统时间戳服务] 系统时间戳已设置为: ${setTimestamp.toISOString()}`)
    
    return setTimestamp
  } catch (error: any) {
    console.error('[系统时间戳服务] 设置系统时间戳失败:', error)
    throw new Error(`设置系统时间戳失败: ${error.message}`)
  }
}

/**
 * 获取系统时间戳配置信息
 * 包括当前系统时间戳和最后更新时间
 * 
 * @returns 系统时间戳配置信息
 */
export async function getSystemTimestampConfig(): Promise<{
  system_timestamp: string
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
      WHERE config_key = 'current_system_timestamp'
    `
    
    if (result.length === 0) {
      throw new Error('系统时间戳配置不存在')
    }
    
    return {
      system_timestamp: result[0].config_value,
      updated_at: result[0].updated_at ? result[0].updated_at.toISOString() : null,
      updated_by: result[0].updated_by ? Number(result[0].updated_by) : null,
    }
  } catch (error: any) {
    console.error('[系统时间戳服务] 获取系统时间戳配置失败:', error)
    throw new Error(`获取系统时间戳配置失败: ${error.message}`)
  }
}

