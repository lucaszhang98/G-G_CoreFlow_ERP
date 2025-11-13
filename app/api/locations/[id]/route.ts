import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { locationUpdateSchema } from '@/lib/validations/location';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const location = await prisma.locations.findUnique({
      where: { location_id: BigInt(params.id) },
      include: {
        warehouses: {
          select: {
            warehouse_id: true,
            name: true,
          },
        },
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: '位置不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: serializeBigInt(location),
    });
  } catch (error) {
    return handleError(error, '获取位置详情失败');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin', 'oms_manager', 'tms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const existing = await prisma.locations.findUnique({
      where: { location_id: BigInt(params.id) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '位置不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = locationUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    if (data.location_code && data.location_code !== existing.location_code) {
      const codeExists = await prisma.locations.findUnique({
        where: { location_code: data.location_code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: '位置代码已存在' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (data.location_code) updateData.location_code = data.location_code;
    if (data.name) updateData.name = data.name;
    if (data.location_type) updateData.location_type = data.location_type;
    if (data.address_line1 !== undefined) updateData.address_line1 = data.address_line1;
    if (data.address_line2 !== undefined) updateData.address_line2 = data.address_line2;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.postal_code !== undefined) updateData.postal_code = data.postal_code;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const location = await prisma.locations.update({
      where: { location_id: BigInt(params.id) },
      data: updateData,
    });

    return NextResponse.json({
      data: serializeBigInt(location),
      message: '位置更新成功',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '位置代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '更新位置失败');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const location = await prisma.locations.findUnique({
      where: { location_id: BigInt(params.id) },
      include: {
        warehouses: { take: 1 },
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: '位置不存在' },
        { status: 404 }
      );
    }

    if (location.warehouses.length > 0) {
      return NextResponse.json(
        { error: '位置有关联仓库，无法删除' },
        { status: 409 }
      );
    }

    await prisma.locations.delete({
      where: { location_id: BigInt(params.id) },
    });

    return NextResponse.json({
      message: '位置删除成功',
    });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '位置有关联数据，无法删除' },
        { status: 409 }
      );
    }
    return handleError(error, '删除位置失败');
  }
}

