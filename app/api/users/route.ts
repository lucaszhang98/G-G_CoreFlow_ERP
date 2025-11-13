import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, parsePaginationParams, buildPaginationResponse, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { userCreateSchema } from '@/lib/validations/user';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * GET /api/users
 * 获取用户列表
 */
export async function GET(request: NextRequest) {
  try {
    // 检查权限（只有 admin 可以查看用户列表）
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, sort, order } = parsePaginationParams(searchParams);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const departmentId = searchParams.get('department_id');

    // 构建查询条件
    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' as const } },
        { full_name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (role) {
      where.role = role;
    }
    if (status) {
      where.status = status;
    }
    if (departmentId) {
      where.department_id = BigInt(departmentId);
    }

    // 查询数据
    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
        select: {
          id: true,
          username: true,
          email: true,
          full_name: true,
          department_id: true,
          role: true,
          status: true,
          phone: true,
          avatar_url: true,
          created_at: true,
          updated_at: true,
          departments: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.users.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginationResponse(
        serializeBigInt(users),
        total,
        page,
        limit
      )
    );
  } catch (error) {
    return handleError(error, '获取用户列表失败');
  }
}

/**
 * POST /api/users
 * 创建用户
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
      select: {
        id: true,
        username: true,
        email: true,
        full_name: true,
        role: true,
        status: true,
        created_at: true,
      },
    });

    return NextResponse.json(
      {
        data: serializeBigInt(user),
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

