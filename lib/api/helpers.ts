/**
 * API 工具函数
 * 包含权限检查、分页、错误处理等通用功能
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { ZodError } from 'zod';

/**
 * 检查用户是否登录
 */
export async function checkAuth() {
  const session = await auth();
  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      ),
      user: null,
    };
  }
  return {
    error: null,
    user: session.user,
  };
}

/**
 * 检查用户权限
 * @param allowedRoles 允许的角色列表（例如 ['admin'] 或 ['admin', 'oms_manager']）
 */
export async function checkPermission(allowedRoles: string[]) {
  const authResult = await checkAuth();
  if (authResult.error) {
    return authResult;
  }

  const user = authResult.user;
  if (!user) {
    return {
      error: NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      ),
      user: null,
    };
  }

  // 如果允许的角色列表包含 'admin'，且用户角色是 'admin'，直接通过
  // admin 用户拥有完整权限
  if (allowedRoles.includes('admin') && user.role === 'admin') {
    return {
      error: null,
      user: user,
    };
  }

  try {
    // 从数据库查询最新角色（以防 session 中的角色不是最新的）
    const dbUser = await prisma.users.findUnique({
      where: { id: BigInt(user.id) },
      select: { role: true, status: true },
    });

    // 检查用户是否存在且状态为活跃
    if (!dbUser || dbUser.status !== 'active') {
      return {
        error: NextResponse.json(
          { error: '用户不存在或已被禁用' },
          { status: 403 }
        ),
        user: null,
      };
    }

    // admin 用户拥有所有权限
    const userRole = dbUser.role || user.role;
    if (userRole === 'admin' || allowedRoles.includes(userRole || '')) {
      return {
        error: null,
        user: user,
      };
    }

    return {
      error: NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      ),
      user: null,
    };
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      error: NextResponse.json(
        { error: '权限检查失败，请稍后重试' },
        { status: 500 }
      ),
      user: null,
    };
  }
}

/**
 * 解析分页参数
 */
export function parsePaginationParams(searchParams: URLSearchParams, defaultSort: string = 'code', defaultOrder: 'asc' | 'desc' = 'asc') {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
  const sort = searchParams.get('sort') || defaultSort;
  const order = searchParams.get('order') === 'asc' ? 'asc' : (searchParams.get('order') === 'desc' ? 'desc' : defaultOrder);

  return { page, limit, sort, order };
}

/**
 * 构建分页响应
 */
export function buildPaginationResponse(data: any[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 处理 Zod 验证错误
 */
export function handleValidationError(error: ZodError) {
  const details = error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return NextResponse.json(
    {
      error: '数据验证失败',
      details,
    },
    { status: 400 }
  );
}

/**
 * 处理数据库唯一约束错误
 */
export function handleUniqueConstraintError(error: any, fieldName: string) {
  if (error.code === 'P2002') {
    return NextResponse.json(
      {
        error: `${fieldName}已存在`,
      },
      { status: 409 }
    );
  }
  return null;
}

/**
 * 处理外键约束错误（删除时有关联数据）
 */
export function handleForeignKeyError(error: any, message: string) {
  if (error.code === 'P2003') {
    return NextResponse.json(
      {
        error: message || '有关联数据，无法删除',
      },
      { status: 409 }
    );
  }
  return null;
}

/**
 * 处理通用错误
 */
export function handleError(error: any, defaultMessage: string = '操作失败') {
  console.error('API Error:', error);

  // 尝试处理已知错误
  const uniqueError = handleUniqueConstraintError(error, '资源');
  if (uniqueError) return uniqueError;

  const fkError = handleForeignKeyError(error, '');
  if (fkError) return fkError;

  // 返回通用错误
  return NextResponse.json(
    {
      error: defaultMessage,
    },
    { status: 500 }
  );
}

/**
 * 自动添加系统维护字段（创建人/时间、修改人/时间）
 * @param data 要处理的数据对象
 * @param user 当前用户对象
 * @param isCreate 是否为创建操作（true: 创建, false: 更新）
 */
export function addSystemFields(data: any, user: any, isCreate: boolean = true): any {
  const userId = user?.id ? BigInt(user.id) : null
  const now = new Date()
  
  if (isCreate) {
    // 创建操作：设置 created_by 和 created_at
    if (!data.created_by && userId) {
      data.created_by = userId
    }
    if (!data.created_at) {
      data.created_at = now
    }
    // 创建时也设置 updated_by 和 updated_at
    if (!data.updated_by && userId) {
      data.updated_by = userId
    }
    if (!data.updated_at) {
      data.updated_at = now
    }
  } else {
    // 更新操作：只更新 updated_by 和 updated_at
    if (userId) {
      data.updated_by = userId
    }
    data.updated_at = now
    // 更新时不能修改 created_by 和 created_at
    delete data.created_by
    delete data.created_at
  }
  
  return data
}

/**
 * 将 BigInt 和 Decimal 转换为字符串（用于 JSON 响应）
 */
export function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 处理 Date 对象 - 必须在检查 object 类型之前
  if (obj instanceof Date) {
    // 检查日期是否有效
    if (isNaN(obj.getTime())) {
      return null;
    }
    // 对于 DATE 类型（只有日期，没有时间），返回 YYYY-MM-DD 格式
    // 对于 TIMESTAMPTZ 类型（有日期和时间），返回 ISO 字符串
    // 如果时间是 00:00:00.000Z，说明是 DATE 类型，只返回日期部分
    const iso = obj.toISOString();
    if (iso.endsWith('T00:00:00.000Z')) {
      return iso.split('T')[0]; // 返回 YYYY-MM-DD
    }
    return iso; // 返回完整的 ISO 字符串
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  // 处理 Prisma Decimal 类型
  if (typeof obj === 'object' && obj !== null) {
    // Prisma Decimal 类型有 toString 方法
    if ('toString' in obj && typeof obj.toString === 'function') {
      // 检查是否是 Decimal 类型（通常有 toNumber 方法）
      if ('toNumber' in obj || obj.constructor?.name === 'Decimal') {
        return obj.toString();
      }
    }
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }

  return obj;
}

