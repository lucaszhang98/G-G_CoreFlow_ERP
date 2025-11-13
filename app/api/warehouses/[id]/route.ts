import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { warehouseUpdateSchema } from '@/lib/validations/warehouse';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const warehouse = await prisma.warehouses.findUnique({
      where: { warehouse_id: BigInt(params.id) },
      include: {
        locations: true,
        users: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!warehouse) {
      return NextResponse.json(
        { error: '仓库不存在' },
        { status: 404 }
      );
    }

    // 获取库存统计（如果有 inventory_lots 表）
    // 这里先返回空，后续可以添加实际统计

    return NextResponse.json({
      data: serializeBigInt(warehouse),
    });
  } catch (error) {
    return handleError(error, '获取仓库详情失败');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin', 'wms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const existing = await prisma.warehouses.findUnique({
      where: { warehouse_id: BigInt(params.id) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '仓库不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = warehouseUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    if (data.warehouse_code && data.warehouse_code !== existing.warehouse_code) {
      const codeExists = await prisma.warehouses.findUnique({
        where: { warehouse_code: data.warehouse_code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: '仓库代码已存在' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (data.warehouse_code) updateData.warehouse_code = data.warehouse_code;
    if (data.name) updateData.name = data.name;
    if (data.location_id !== undefined) {
      updateData.location_id = data.location_id ? BigInt(data.location_id) : null;
    }
    if (data.capacity_cbm !== undefined) updateData.capacity_cbm = data.capacity_cbm;
    if (data.operating_hours !== undefined) updateData.operating_hours = data.operating_hours as any;
    if (data.contact_user_id !== undefined) {
      updateData.contact_user_id = data.contact_user_id ? BigInt(data.contact_user_id) : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    const warehouse = await prisma.warehouses.update({
      where: { warehouse_id: BigInt(params.id) },
      data: updateData,
    });

    return NextResponse.json({
      data: serializeBigInt(warehouse),
      message: '仓库更新成功',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '仓库代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '更新仓库失败');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const warehouse = await prisma.warehouses.findUnique({
      where: { warehouse_id: BigInt(params.id) },
    });

    if (!warehouse) {
      return NextResponse.json(
        { error: '仓库不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联库存（这里需要根据实际表结构检查）
    // 暂时先删除，后续可以添加检查

    await prisma.warehouses.delete({
      where: { warehouse_id: BigInt(params.id) },
    });

    return NextResponse.json({
      message: '仓库删除成功',
    });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '仓库有关联库存，无法删除' },
        { status: 409 }
      );
    }
    return handleError(error, '删除仓库失败');
  }
}

