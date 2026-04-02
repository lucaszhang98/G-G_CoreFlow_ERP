import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, handleError, serializeBigInt } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';
import { getOutboundShipmentDetail } from '@/lib/services/outbound-shipment-detail';
import { applyOutboundShipmentRequestBody } from '@/lib/services/outbound-shipment-apply-request-body';

// GET - 获取单个出库管理记录（通过 appointment_id）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const resolvedParams = await params;
    const appointmentId = resolvedParams.id;

    if (!appointmentId || isNaN(Number(appointmentId))) {
      return NextResponse.json(
        { error: '无效的预约ID' },
        { status: 400 }
      );
    }

    const detail = await getOutboundShipmentDetail(appointmentId);
    if (!detail) {
      return NextResponse.json(
        { error: '预约记录不存在或直送订单不在出库管理范围内' },
        { status: 404 }
      );
    }

    return NextResponse.json(detail);
  } catch (error: any) {
    console.error('获取出库管理记录失败:', error);
    return handleError(error);
  }
}

// PUT - 更新出库管理（outbound_shipments + delivery_appointments 可写字段）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const appointmentId = resolvedParams.id;

    if (!appointmentId || isNaN(Number(appointmentId))) {
      return NextResponse.json(
        { error: '无效的预约ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // 检查登录
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    
    // 获取当前用户
    const user = authResult.user || null;

    const applyErr = await applyOutboundShipmentRequestBody(appointmentId, body, user);
    if (applyErr) {
      return NextResponse.json({ error: applyErr.error }, { status: applyErr.status });
    }

    // 重新查询以获取完整的关联数据用于返回（包括 delivery_appointments 中的字段）
    const finalAppointment = await prisma.delivery_appointments.findUnique({
      where: { appointment_id: BigInt(appointmentId) },
      include: {
        outbound_shipments: {
          select: {
            outbound_shipment_id: true,
            trailer_id: true,
            trailer_code: true,
            loaded_by: true,
            notes: true,
            delivery_address: true,
            contact_name: true,
            contact_phone: true,
            users_outbound_shipments_loaded_byTousers: {
              select: {
                id: true,
                username: true,
              },
            },
          } as any,
        },
      },
    });
    
    // 序列化 BigInt 字段并合并数据
    const finalOutboundShipment = finalAppointment?.outbound_shipments 
      ? serializeBigInt(finalAppointment.outbound_shipments) 
      : null;
    
    // 合并 delivery_appointments 中的字段
    if (finalOutboundShipment && finalAppointment) {
      (finalOutboundShipment as any).verify_loading_sheet = finalAppointment.verify_loading_sheet === true;
      (finalOutboundShipment as any).has_created_sheet = finalAppointment.has_created_sheet === true;
      (finalOutboundShipment as any).can_create_sheet = finalAppointment.can_create_sheet === true;
      (finalOutboundShipment as any).rejected = finalAppointment.rejected === true;
    }
    
    console.log(`[OutboundShipments] 最终查询结果 - loaded_by:`, finalOutboundShipment?.loaded_by, `loaded_by_name:`, finalOutboundShipment?.users_outbound_shipments_loaded_byTousers?.username)

    if (!finalOutboundShipment) {
      return NextResponse.json(
        { error: '出库管理记录不存在' },
        { status: 404 }
      );
    }

    // 获取 appointment 信息用于返回
    const appointmentForResponseRaw = await prisma.delivery_appointments.findUnique({
      where: { appointment_id: BigInt(appointmentId) },
      include: {
        appointment_detail_lines: {
          select: {
            estimated_pallets: true,
          },
        },
        locations: {
          select: {
            location_code: true,
          },
        },
        locations_delivery_appointments_origin_location_idTolocations: {
          select: {
            location_code: true,
          },
        },
      },
    });
    
    // 序列化 BigInt 字段
    const appointmentForResponse = appointmentForResponseRaw ? serializeBigInt(appointmentForResponseRaw) : null;
    
    let totalPallets = 0;
    if (appointmentForResponse?.appointment_detail_lines && Array.isArray(appointmentForResponse.appointment_detail_lines)) {
      totalPallets = appointmentForResponse.appointment_detail_lines.reduce((sum: number, line: any) => {
        return sum + (line.estimated_pallets || 0);
      }, 0);
    }

    return NextResponse.json({
      data: {
        // 从 delivery_appointments 获取的字段（已序列化）
        appointment_id: appointmentForResponse?.appointment_id?.toString() || appointmentId,
        reference_number: appointmentForResponse?.reference_number || null,
        delivery_method: appointmentForResponse?.delivery_method || null,
        rejected: appointmentForResponse?.rejected || false,
        appointment_account: appointmentForResponse?.appointment_account || null,
        appointment_type: appointmentForResponse?.appointment_type || null,
        origin_location: appointmentForResponse?.locations_delivery_appointments_origin_location_idTolocations?.location_code || null,
        destination_location: appointmentForResponse?.locations?.location_code || null,
        confirmed_start: appointmentForResponse?.confirmed_start || null,
        total_pallets: totalPallets,
        
        // 从 outbound_shipments 获取的字段（已序列化）
        outbound_shipment_id: finalOutboundShipment?.outbound_shipment_id?.toString() || null,
        trailer_id: finalOutboundShipment?.trailer_id?.toString() || null,
        trailer_code: finalOutboundShipment?.trailer_code || null,
        loaded_by: finalOutboundShipment?.loaded_by?.toString() || null,
        loaded_by_name: finalOutboundShipment?.users_outbound_shipments_loaded_byTousers?.username || null,
        notes: finalOutboundShipment?.notes || null,
        delivery_address: finalOutboundShipment?.delivery_address ?? null,
        contact_name: finalOutboundShipment?.contact_name ?? null,
        contact_phone: finalOutboundShipment?.contact_phone ?? null,

        // 关联对象（用于 relation 类型字段的显示，已序列化）
        users_outbound_shipments_loaded_byTousers: finalOutboundShipment?.users_outbound_shipments_loaded_byTousers || null,
      },
      message: '更新成功',
    });
  } catch (error: any) {
    console.error('更新出库管理记录失败:', error);
    return handleError(error);
  }
}

// DELETE - 不允许删除（出库管理记录应该与预约管理记录关联）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: '出库管理记录不能删除，它们与预约管理记录关联' },
    { status: 405 }
  );
}
