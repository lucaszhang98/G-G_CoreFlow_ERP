import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { departmentUpdateSchema } from '@/lib/validations/department';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const department = await prisma.departments.findUnique({
      where: { id: BigInt(params.id) },
      include: {
        departments: true, // 父部门
        other_departments: true, // 子部门
        users: {
          select: {
            id: true,
            username: true,
            full_name: true,
          },
        },
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: '部门不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: serializeBigInt(department),
    });
  } catch (error) {
    return handleError(error, '获取部门详情失败');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const existing = await prisma.departments.findUnique({
      where: { id: BigInt(params.id) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '部门不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = departmentUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 检查循环引用
    if (data.parent_id && data.parent_id.toString() === params.id) {
      return NextResponse.json(
        { error: '不能将部门设置为自己的子部门' },
        { status: 400 }
      );
    }

    // 检查代码冲突
    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.departments.findUnique({
        where: { code: data.code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: '部门代码已存在' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.code) updateData.code = data.code;
    if (data.parent_id !== undefined) {
      updateData.parent_id = data.parent_id ? BigInt(data.parent_id) : null;
    }
    if (data.manager_id !== undefined) {
      updateData.manager_id = data.manager_id ? BigInt(data.manager_id) : null;
    }
    if (data.description !== undefined) updateData.description = data.description;

    const department = await prisma.departments.update({
      where: { id: BigInt(params.id) },
      data: updateData,
    });

    return NextResponse.json({
      data: serializeBigInt(department),
      message: '部门更新成功',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '部门代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '更新部门失败');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const department = await prisma.departments.findUnique({
      where: { id: BigInt(params.id) },
      include: {
        other_departments: { take: 1 },
        users: { take: 1 },
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: '部门不存在' },
        { status: 404 }
      );
    }

    if (department.other_departments.length > 0) {
      return NextResponse.json(
        { error: '部门有子部门，无法删除' },
        { status: 409 }
      );
    }

    if (department.users.length > 0) {
      return NextResponse.json(
        { error: '部门有员工，无法删除' },
        { status: 409 }
      );
    }

    await prisma.departments.delete({
      where: { id: BigInt(params.id) },
    });

    return NextResponse.json({
      message: '部门删除成功',
    });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '部门有关联数据，无法删除' },
        { status: 409 }
      );
    }
    return handleError(error, '删除部门失败');
  }
}

