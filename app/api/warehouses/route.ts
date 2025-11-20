import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, parsePaginationParams, buildPaginationResponse, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { warehouseCreateSchema, warehouseUpdateSchema } from '@/lib/validations/warehouse';
import prisma from '@/lib/prisma';

/**
 * GET /api/warehouses
 * 获取仓库列表
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, sort, order } = parsePaginationParams(searchParams, 'warehouse_code', 'asc');
    const search = searchParams.get('search') || '';
    const locationId = searchParams.get('location_id');

    const where: any = {};
    if (search) {
      where.OR = [
        { warehouse_code: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (locationId) {
      where.location_id = BigInt(locationId);
    }

    const [warehouses, total] = await Promise.all([
      prisma.warehouses.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          locations: {
            select: {
              location_id: true,
              name: true,
              address_line1: true,
              city: true,
            },
          },
          users: {
            select: {
              id: true,
              full_name: true,
            },
          },
        },
      }),
      prisma.warehouses.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginationResponse(
        serializeBigInt(warehouses),
        total,
        page,
        limit
      )
    );
  } catch (error) {
    return handleError(error, '获取仓库列表失败');
  }
}

/**
 * POST /api/warehouses
 * 创建仓库
 */
export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(['admin', 'wms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const body = await request.json();
    const validationResult = warehouseCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    if (data.warehouse_code) {
      const existing = await prisma.warehouses.findUnique({
        where: { warehouse_code: data.warehouse_code },
      });
      if (existing) {
        return NextResponse.json(
          { error: '仓库代码已存在' },
          { status: 409 }
        );
      }
    }

    const warehouse = await prisma.warehouses.create({
      data: {
        warehouse_code: data.warehouse_code,
        name: data.name,
        location_id: data.location_id ? BigInt(data.location_id) : null,
        capacity_cbm: data.capacity_cbm,
        operating_hours: data.operating_hours as any,
        contact_user_id: data.contact_user_id ? BigInt(data.contact_user_id) : null,
        notes: data.notes,
      },
    });

    return NextResponse.json(
      {
        data: serializeBigInt(warehouse),
        message: '仓库创建成功',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '仓库代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '创建仓库失败');
  }
}

