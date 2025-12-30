import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { userUpdateSchema } from '@/lib/validations/user';
import prisma from '@/lib/prisma';

/**
 * GET /api/users/:id
 * 获取用户详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    // 检查权限（只有 admin 可以查看用户详情）
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const user = await prisma.users.findUnique({
      where: { id: BigInt(resolvedParams.id) },
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

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    const serialized = serializeBigInt(user);
    // 转换关系名称：departments_users_department_idTodepartments -> department
    if (serialized?.departments_users_department_idTodepartments) {
      serialized.department = serialized.departments_users_department_idTodepartments;
      delete serialized.departments_users_department_idTodepartments;
    }
    
    return NextResponse.json({
      data: serialized,
    });
  } catch (error) {
    return handleError(error, '获取用户详情失败');
  }
}

/**
 * PUT /api/users/:id
 * 更新用户
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    // 检查权限（只有 admin 可以更新用户）
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    // 检查用户是否存在
    const existing = await prisma.users.findUnique({
      where: { id: BigInt(resolvedParams.id) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // 验证数据
    const validationResult = userUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 如果修改了邮箱，检查是否冲突
    if (data.email && data.email !== existing.email) {
      const emailExists = await prisma.users.findUnique({
        where: { email: data.email },
      });
      if (emailExists) {
        return NextResponse.json(
          { error: '邮箱已存在' },
          { status: 409 }
        );
      }
    }

    // 更新用户
    const updateData: any = {};

    if (data.email) updateData.email = data.email;
    if (data.full_name !== undefined) updateData.full_name = data.full_name;
    if (data.department_id !== undefined) {
      updateData.department_id = data.department_id ? BigInt(data.department_id) : null;
    }
    if (data.role) updateData.role = data.role;
    if (data.status) updateData.status = data.status;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;

    const user = await prisma.users.update({
      where: { id: BigInt(resolvedParams.id) },
      data: updateData,
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
        updated_at: true,
      },
    });

    return NextResponse.json({
      data: serializeBigInt(user),
      message: '用户更新成功',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '邮箱已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '更新用户失败');
  }
}

/**
 * DELETE /api/users/:id
 * 删除用户
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    // 检查权限（只有 admin 可以删除用户）
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    // 检查用户是否存在
    const user = await prisma.users.findUnique({
      where: { id: BigInt(resolvedParams.id) },
      include: {
        orders_orders_created_byTousers: { take: 1 },
        orders_orders_updated_byTousers: { take: 1 },
        orders_orders_user_idTousers: { take: 1 },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联数据
    const hasRelatedData =
      user.orders_orders_created_byTousers.length > 0 ||
      user.orders_orders_updated_byTousers.length > 0 ||
      user.orders_orders_user_idTousers.length > 0;

    if (hasRelatedData) {
      return NextResponse.json(
        { error: '用户有关联数据，无法删除' },
        { status: 409 }
      );
    }

    // 删除用户
    await prisma.users.delete({
      where: { id: BigInt(resolvedParams.id) },
    });

    return NextResponse.json({
      message: '用户删除成功',
    });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '用户有关联数据，无法删除' },
        { status: 409 }
      );
    }
    return handleError(error, '删除用户失败');
  }
}

