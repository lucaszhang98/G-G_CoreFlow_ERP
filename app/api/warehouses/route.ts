import { NextRequest, NextResponse } from 'next/server';
import { checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { warehouseCreateSchema, warehouseUpdateSchema } from '@/lib/validations/warehouse';
import prisma from '@/lib/prisma';
import { warehouseConfig } from '@/lib/crud/configs/warehouses';
import { createListHandler } from '@/lib/crud/api-handler';

// 使用通用框架处理 GET
const baseListHandler = createListHandler(warehouseConfig);

/**
 * GET /api/warehouses
 * 获取仓库列表 - 使用通用框架
 */
export async function GET(request: NextRequest) {
  return baseListHandler(request);
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

