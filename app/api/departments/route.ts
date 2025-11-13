import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { departmentCreateSchema, departmentUpdateSchema } from '@/lib/validations/department';
import prisma from '@/lib/prisma';

/**
 * GET /api/departments
 * 获取部门列表（树形结构）
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const parentId = searchParams.get('parent_id');
    const includeChildren = searchParams.get('include_children') === 'true';

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { code: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (parentId) {
      where.parent_id = BigInt(parentId);
    } else if (!includeChildren) {
      where.parent_id = null; // 默认只返回顶级部门
    }

    const departments = await prisma.departments.findMany({
      where,
      include: {
        departments: includeChildren, // 父部门
        other_departments: includeChildren, // 子部门
        users: includeChildren ? {
          select: {
            id: true,
            username: true,
            full_name: true,
          },
        } : false,
      },
      orderBy: { code: 'asc' },
    });

    // 构建树形结构
    const buildTree = (depts: any[], parentId: bigint | null = null) => {
      return depts
        .filter((d) => {
          if (parentId === null) return d.parent_id === null;
          return d.parent_id?.toString() === parentId.toString();
        })
        .map((dept) => ({
          ...serializeBigInt(dept),
          children: includeChildren ? buildTree(depts, dept.id) : [],
        }));
    };

    const tree = includeChildren ? buildTree(departments) : serializeBigInt(departments);

    return NextResponse.json({ data: tree });
  } catch (error) {
    return handleError(error, '获取部门列表失败');
  }
}

/**
 * POST /api/departments
 * 创建部门
 */
export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const body = await request.json();
    const validationResult = departmentCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    const existing = await prisma.departments.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      return NextResponse.json(
        { error: '部门代码已存在' },
        { status: 409 }
      );
    }

    const department = await prisma.departments.create({
      data: {
        name: data.name,
        code: data.code,
        parent_id: data.parent_id ? BigInt(data.parent_id) : null,
        manager_id: data.manager_id ? BigInt(data.manager_id) : null,
        description: data.description,
      },
    });

    return NextResponse.json(
      {
        data: serializeBigInt(department),
        message: '部门创建成功',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '部门代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '创建部门失败');
  }
}

