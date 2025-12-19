/**
 * 导入Service的类型定义
 */

import { z } from 'zod'

/**
 * 导入错误
 */
export interface ImportError {
  row: number
  field: string
  message: string
}

/**
 * 导入结果
 */
export interface ImportResult {
  success: boolean
  imported?: number
  total?: number
  errors?: ImportError[]
}

/**
 * 导入配置
 */
export interface ImportConfig<T> {
  /**
   * 表头映射（Excel列名 → 字段名）
   */
  headerMap: Record<string, string>

  /**
   * 验证Schema
   */
  validationSchema: z.ZodSchema<T>

  /**
   * 权限要求
   */
  requiredRoles: string[]

  /**
   * 预加载主数据（可选）
   * 用于外键验证和关联数据
   */
  loadMasterData?: () => Promise<any>

  /**
   * 检查重复（可选）
   * 返回重复记录的错误信息
   * @param data 验证通过的数据
   * @param masterData 预加载的主数据（可选）
   */
  checkDuplicates?: (data: T[], masterData?: any) => Promise<ImportError[]>

  /**
   * 执行导入（核心业务逻辑）
   * 使用事务确保原子性
   * @returns 可选返回 { successCount } 自定义成功导入的记录数
   */
  executeImport: (data: T[], userId: bigint, masterData?: any) => Promise<void | { successCount?: number }>
}



