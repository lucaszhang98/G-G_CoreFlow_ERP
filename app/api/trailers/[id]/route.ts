import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { trailerUpdateSchema } from '@/lib/validations/trailer';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const trailer = await prisma.trailers.findUnique({
      where: { trailer_id: BigInt(params.id) },
      include: {
        departments: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!trailer) {
      return NextResponse.json(
        { error: '货柜不存在' },
        { status: 404 }
      );
    }

    // 获取关联的出库记录（如果有 outbound_shipments 表）
    // 这里先返回空，后续可以添加

    return NextResponse.json({
      data: serializeBigInt(trailer),
    });
  } catch (error) {
    return handleError(error, '获取货柜详情失败');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin', 'tms_manager', 'wms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const existing = await prisma.trailers.findUnique({
      where: { trailer_id: BigInt(params.id) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '货柜不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = trailerUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    if (data.trailer_code && data.trailer_code !== existing.trailer_code) {
      const codeExists = await prisma.trailers.findUnique({
        where: { trailer_code: data.trailer_code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: '货柜代码已存在' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (data.trailer_code) updateData.trailer_code = data.trailer_code;
    if (data.trailer_type !== undefined) updateData.trailer_type = data.trailer_type;
    if (data.length_feet !== undefined) updateData.length_feet = data.length_feet;
    if (data.capacity_weight !== undefined) updateData.capacity_weight = data.capacity_weight;
    if (data.capacity_volume !== undefined) updateData.capacity_volume = data.capacity_volume;
    if (data.status) updateData.status = data.status;
    if (data.department_id !== undefined) {
      updateData.department_id = data.department_id ? BigInt(data.department_id) : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    const trailer = await prisma.trailers.update({
      where: { trailer_id: BigInt(params.id) },
      data: updateData,
    });

    return NextResponse.json({
      data: serializeBigInt(trailer),
      message: '货柜更新成功',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '货柜代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '更新货柜失败');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const trailer = await prisma.trailers.findUnique({
      where: { trailer_id: BigInt(params.id) },
    });

    if (!trailer) {
      return NextResponse.json(
        { error: '货柜不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联出库记录

    await prisma.trailers.delete({
      where: { trailer_id: BigInt(params.id) },
    });

    return NextResponse.json({
      message: '货柜删除成功',
    });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '货柜有关联出库记录，无法删除' },
        { status: 409 }
      );
    }
    return handleError(error, '删除货柜失败');
  }
}

