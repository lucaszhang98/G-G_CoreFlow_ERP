import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { driverUpdateSchema } from '@/lib/validations/driver';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const driver = await prisma.drivers.findUnique({
      where: { driver_id: BigInt(params.id) },
      include: {
        carriers: {
          select: {
            carrier_id: true,
            name: true,
          },
        },
        contact_roles: true,
      },
    });

    if (!driver) {
      return NextResponse.json(
        { error: '司机不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: serializeBigInt(driver),
    });
  } catch (error) {
    return handleError(error, '获取司机详情失败');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin', 'tms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const existing = await prisma.drivers.findUnique({
      where: { driver_id: BigInt(params.id) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '司机不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = driverUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 检查代码冲突
    if (data.driver_code && data.driver_code !== existing.driver_code) {
      const codeExists = await prisma.drivers.findUnique({
        where: { driver_code: data.driver_code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: '司机代码已存在' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (data.driver_code) updateData.driver_code = data.driver_code;
    if (data.license_number !== undefined) updateData.license_number = data.license_number;
    if (data.license_expiration !== undefined) {
      updateData.license_expiration = data.license_expiration ? new Date(data.license_expiration) : null;
    }
    if (data.status) updateData.status = data.status;
    if (data.carrier_id !== undefined) {
      updateData.carrier_id = data.carrier_id ? BigInt(data.carrier_id) : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

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
            related_entity_type: 'driver',
            related_entity_id: existing.driver_id,
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

    const driver = await prisma.drivers.update({
      where: { driver_id: BigInt(params.id) },
      data: updateData,
    });

    return NextResponse.json({
      data: serializeBigInt(driver),
      message: '司机更新成功',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '司机代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '更新司机失败');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    const driver = await prisma.drivers.findUnique({
      where: { driver_id: BigInt(params.id) },
    });

    if (!driver) {
      return NextResponse.json(
        { error: '司机不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联运输记录

    await prisma.drivers.delete({
      where: { driver_id: BigInt(params.id) },
    });

    return NextResponse.json({
      message: '司机删除成功',
    });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '司机有关联运输记录，无法删除' },
        { status: 409 }
      );
    }
    return handleError(error, '删除司机失败');
  }
}

