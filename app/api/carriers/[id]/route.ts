import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { carrierUpdateSchema } from '@/lib/validations/carrier';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const carrier = await prisma.carriers.findUnique({
      where: { carrier_id: BigInt(params.id) },
      include: {
        contact_roles: true,
        carrier_service_levels: {
          select: {
            service_level_id: true,
            service_level_code: true,
            description: true,
            transit_time_days: true,
          },
        },
        drivers: {
          select: {
            driver_id: true,
            driver_code: true,
            license_number: true,
          },
        },
        vehicles: {
          select: {
            vehicle_id: true,
            vehicle_code: true,
            plate_number: true,
          },
        },
      },
    });

    if (!carrier) {
      return NextResponse.json(
        { error: '承运商不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: serializeBigInt(carrier),
    });
  } catch (error) {
    return handleError(error, '获取承运商详情失败');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin', 'tms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const existing = await prisma.carriers.findUnique({
      where: { carrier_id: BigInt(params.id) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '承运商不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = carrierUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    if (data.carrier_code && data.carrier_code !== existing.carrier_code) {
      const codeExists = await prisma.carriers.findUnique({
        where: { carrier_code: data.carrier_code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: '承运商代码已存在' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (data.carrier_code) updateData.carrier_code = data.carrier_code;
    if (data.name) updateData.name = data.name;
    if (data.carrier_type !== undefined) updateData.carrier_type = data.carrier_type;

    if (data.contact) {
      if (existing.contact_id) {
        await prisma.contact_roles.update({
          where: { contact_id: existing.contact_id },
          data: {
            name: data.contact.name,
            phone: data.contact.phone,
            email: data.contact.email,
            address_line1: data.contact.address_line1,
            address_line2: data.contact.address_line2,
            city: data.contact.city,
            state: data.contact.state,
            postal_code: data.contact.postal_code,
            country: data.contact.country,
          },
        });
      } else {
        const contact = await prisma.contact_roles.create({
          data: {
            related_entity_type: 'carrier',
            related_entity_id: existing.carrier_id,
            role: 'primary',
            name: data.contact.name,
            phone: data.contact.phone,
            email: data.contact.email,
            address_line1: data.contact.address_line1,
            address_line2: data.contact.address_line2,
            city: data.contact.city,
            state: data.contact.state,
            postal_code: data.contact.postal_code,
            country: data.contact.country,
          },
        });
        updateData.contact_id = contact.contact_id;
      }
    }

    const carrier = await prisma.carriers.update({
      where: { carrier_id: BigInt(params.id) },
      data: updateData,
    });

    return NextResponse.json({
      data: serializeBigInt(carrier),
      message: '承运商更新成功',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '承运商代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '更新承运商失败');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const carrier = await prisma.carriers.findUnique({
      where: { carrier_id: BigInt(params.id) },
    });

    if (!carrier) {
      return NextResponse.json(
        { error: '承运商不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联运输记录（这里需要根据实际表结构检查）

    await prisma.carriers.delete({
      where: { carrier_id: BigInt(params.id) },
    });

    return NextResponse.json({
      message: '承运商删除成功',
    });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '承运商有关联运输记录，无法删除' },
        { status: 409 }
      );
    }
    return handleError(error, '删除承运商失败');
  }
}

