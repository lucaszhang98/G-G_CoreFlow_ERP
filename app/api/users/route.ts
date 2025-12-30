import { NextRequest, NextResponse } from 'next/server';
import { createListHandler } from '@/lib/crud/api-handler';
import { userConfig } from '@/lib/crud/configs/users';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { userCreateSchema } from '@/lib/validations/user';

// 使用通用框架处理 GET
const baseListHandler = createListHandler(userConfig);

/**
 * GET /api/users
 * 获取用户列表
 */
export async function GET(request: NextRequest) {
  return baseListHandler(request);
}

/**
 * POST /api/users
 * 创建用户（需要特殊处理密码加密）
 */
export async function POST(request: NextRequest) {
  try {
    // 检查权限（只有 admin 可以创建用户）
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const body = await request.json();

    // 验证数据
    const validationResult = userCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 检查用户名和邮箱是否已存在
    const [existingUsername, existingEmail] = await Promise.all([
      prisma.users.findUnique({ where: { username: data.username } }),
      prisma.users.findUnique({ where: { email: data.email } }),
    ]);

    if (existingUsername) {
      return NextResponse.json(
        { error: '用户名已存在' },
        { status: 409 }
      );
    }

    if (existingEmail) {
      return NextResponse.json(
        { error: '邮箱已存在' },
        { status: 409 }
      );
    }

    // 哈希密码
    const passwordHash = await bcrypt.hash(data.password, 10);

    // 创建用户
    const user = await prisma.users.create({
      data: {
        username: data.username,
        email: data.email,
        password_hash: passwordHash,
        full_name: data.full_name,
        department_id: data.department_id ? BigInt(data.department_id) : null,
        role: data.role,
        status: data.status,
        phone: data.phone,
        avatar_url: data.avatar_url,
      },
      include: {
        departments_users_department_idTodepartments: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    const serialized = serializeBigInt(user);
    // 转换关系名称：departments_users_department_idTodepartments -> department
    if (serialized?.departments_users_department_idTodepartments) {
      serialized.department = serialized.departments_users_department_idTodepartments;
      delete serialized.departments_users_department_idTodepartments;
    }
    
    return NextResponse.json(
      {
        data: serialized,
        message: '用户创建成功',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      return NextResponse.json(
        { error: `${field === 'username' ? '用户名' : '邮箱'}已存在` },
        { status: 409 }
      );
    }
    return handleError(error, '创建用户失败');
  }
}

