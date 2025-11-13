import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { vehicleUpdateSchema } from '@/lib/validations/vehicle';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const vehicle = await prisma.vehicles.findUnique({
      where: { vehicle_id: BigInt(params.id) },
      include: {
        carriers: {
          select: {
            carrier_id: true,
            name: true,
          },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: '车辆不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: serializeBigInt(vehicle),
    });
  } catch (error) {
    return handleError(error, '获取车辆详情失败');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin', 'tms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const existing = await prisma.vehicles.findUnique({
      where: { vehicle_id: BigInt(params.id) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '车辆不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = vehicleUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 检查代码和车牌号冲突
    if (data.vehicle_code && data.vehicle_code !== existing.vehicle_code) {
      const codeExists = await prisma.vehicles.findUnique({
        where: { vehicle_code: data.vehicle_code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: '车辆代码已存在' },
          { status: 409 }
        );
      }
    }

    if (data.plate_number && data.plate_number !== existing.plate_number) {
      const plateExists = await prisma.vehicles.findUnique({
        where: { plate_number: data.plate_number },
      });
      if (plateExists) {
        return NextResponse.json(
          { error: '车牌号已存在' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (data.vehicle_code) updateData.vehicle_code = data.vehicle_code;
    if (data.plate_number) updateData.plate_number = data.plate_number;
    if (data.vehicle_type !== undefined) updateData.vehicle_type = data.vehicle_type;
    if (data.vin !== undefined) updateData.vin = data.vin;
    if (data.capacity_weight !== undefined) updateData.capacity_weight = data.capacity_weight;
    if (data.capacity_volume !== undefined) updateData.capacity_volume = data.capacity_volume;
    if (data.status) updateData.status = data.status;
    if (data.carrier_id !== undefined) {
      updateData.carrier_id = data.carrier_id ? BigInt(data.carrier_id) : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    const vehicle = await prisma.vehicles.update({
      where: { vehicle_id: BigInt(params.id) },
      data: updateData,
    });

    return NextResponse.json({
      data: serializeBigInt(vehicle),
      message: '车辆更新成功',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      return NextResponse.json(
        { error: `${field === 'vehicle_code' ? '车辆代码' : '车牌号'}已存在` },
        { status: 409 }
      );
    }
    return handleError(error, '更新车辆失败');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const vehicle = await prisma.vehicles.findUnique({
      where: { vehicle_id: BigInt(params.id) },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: '车辆不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联运输记录

    await prisma.vehicles.delete({
      where: { vehicle_id: BigInt(params.id) },
    });

    return NextResponse.json({
      message: '车辆删除成功',
    });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '车辆有关联运输记录，无法删除' },
        { status: 409 }
      );
    }
    return handleError(error, '删除车辆失败');
  }
}

