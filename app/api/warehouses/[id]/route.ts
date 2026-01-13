import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { warehouseUpdateSchema } from '@/lib/validations/warehouse';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const resolvedParams = await Promise.resolve(params);
    const warehouse = await prisma.warehouses.findUnique({
      where: { warehouse_id: BigInt(resolvedParams.id) },
      include: {
        locations: {
          select: {
            location_id: true,
            location_code: true,
            name: true,
            address_line1: true,
            address_line2: true,
            city: true,
            state: true,
            postal_code: true,
            country: true,
          },
        },
        users_warehouses_contact_user_idTousers: {
          select: {
            id: true,
            username: true,
            full_name: true,
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

    // 获取库存统计
    const inventoryStats = await prisma.inventory_lots.groupBy({
      by: ['status'],
      where: {
        warehouse_id: BigInt(resolvedParams.id),
      },
      _count: {
        inventory_lot_id: true,
      },
    });

    const totalLots = inventoryStats.reduce((sum: number, stat: any) => sum + stat._count.inventory_lot_id, 0);
    const availableLots = inventoryStats.find((s: any) => s.status === 'available')?._count.inventory_lot_id || 0;
    const reservedLots = inventoryStats.find((s: any) => s.status === 'reserved')?._count.inventory_lot_id || 0;

    const serialized = serializeBigInt(warehouse);
    // 转换关系名称
    if (serialized?.locations) {
      serialized.location = serialized.locations;
      delete serialized.locations;
    }
    if (serialized?.users_warehouses_contact_user_idTousers) {
      serialized.contact_user = serialized.users_warehouses_contact_user_idTousers;
      delete serialized.users_warehouses_contact_user_idTousers;
    }
    
    return NextResponse.json({
      data: {
        ...serialized,
        inventory_stats: {
          total_lots: totalLots,
          available_lots: availableLots,
          reserved_lots: reservedLots,
        },
      },
    });
  } catch (error) {
    return handleError(error, '获取仓库详情失败');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin', 'wms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const resolvedParams = await Promise.resolve(params);
    const existing = await prisma.warehouses.findUnique({
      where: { warehouse_id: BigInt(resolvedParams.id) },
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
      where: { warehouse_id: BigInt(resolvedParams.id) },
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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const resolvedParams = await Promise.resolve(params);
    const warehouse = await prisma.warehouses.findUnique({
      where: { warehouse_id: BigInt(resolvedParams.id) },
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
      where: { warehouse_id: BigInt(resolvedParams.id) },
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

