import { NextRequest, NextResponse } from 'next/server';
import {
  checkAuth,
  checkPermission,
  handleValidationError,
  handleError,
  serializeBigInt,
  addSystemFields,
} from '@/lib/api/helpers';
import { deliveryAppointmentConfig } from '@/lib/crud/configs/delivery-appointments';
import { deliveryAppointmentUpdateSchema } from '@/lib/validations/delivery-appointment';
import prisma from '@/lib/prisma';

// GET - 获取单个预约管理记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 检查登录
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;

    let item: any = null;
    
    try {
      item = await prisma.delivery_appointments.findUnique({
        where: {
          appointment_id: BigInt(id),
        },
        include: {
          orders: {
            select: {
              order_id: true,
              order_number: true,
              eta_date: true,
              order_detail: {
                select: {
                  id: true,
                  estimated_pallets: true,
                },
              },
            },
          },
          locations: {
            select: {
              location_id: true,
              name: true,
              location_code: true,
            },
          },
          locations_delivery_appointments_origin_location_idTolocations: {
            select: {
              location_id: true,
              name: true,
              location_code: true,
            },
          },
          outbound_shipments: {
            select: {
              trailer_code: true,
              notes: true,
            } as any,
          },
        },
      });
    } catch (queryError: any) {
      console.error('Prisma 查询错误:', queryError);
      // 如果是因为关联不存在，尝试简化查询
      if (queryError.message?.includes('Unknown field') || queryError.message?.includes('Available options')) {
        console.log('尝试简化查询（移除可能不存在的关联）');
        item = await prisma.delivery_appointments.findUnique({
          where: {
            appointment_id: BigInt(id),
          },
          include: {
            orders: {
              select: {
                order_id: true,
                order_number: true,
                eta_date: true,
                order_detail: {
                  select: {
                    id: true,
                    estimated_pallets: true,
                  },
                },
              },
            },
            locations: {
              select: {
                location_id: true,
                name: true,
                location_code: true,
              },
            },
            outbound_shipments: {
              select: {
                trailer_code: true,
                notes: true,
              } as any,
            },
          },
        });
      } else {
        throw queryError;
      }
    }

    if (!item) {
      return NextResponse.json(
        { error: '预约管理记录不存在' },
        { status: 404 }
      );
    }

    const serialized = serializeBigInt(item);
    
    // 导入时间格式化函数（直接显示 UTC 时间，不做时区转换）
    const { formatUTCDateTimeString } = await import('@/lib/utils/datetime-pst')
    
    // 格式化数据
    const deliveryMethod = serialized.delivery_method || null;
    const appointmentAccount = serialized.appointment_account || null;
    // 直接使用 appointment_type 字段
    const appointmentType = serialized.appointment_type || null;
    // 返回location_id用于表单，同时返回location_code用于显示
    const originLocationId = serialized.origin_location_id || null;
    const originLocationCode = serialized.locations_delivery_appointments_origin_location_idTolocations?.location_code || null;
    const destinationLocationId = serialized.location_id || null;
    const destinationLocationCode = serialized.locations?.location_code || null;
    const totalPallets = serialized.orders?.order_detail?.reduce((sum: number, detail: any) => {
      return sum + (Number(detail.estimated_pallets) || 0);
    }, 0) || null;
    
    // 时间字段：直接格式化 UTC 时间，不做时区转换
    const requestedStart = serialized.requested_start 
      ? formatUTCDateTimeString(serialized.requested_start) 
      : null
    const requestedEnd = serialized.requested_end 
      ? formatUTCDateTimeString(serialized.requested_end) 
      : null
    const confirmedStart = serialized.confirmed_start 
      ? formatUTCDateTimeString(serialized.confirmed_start) 
      : null
    const confirmedEnd = serialized.confirmed_end 
      ? formatUTCDateTimeString(serialized.confirmed_end) 
      : null
    
    // 拒收、校验PO、校验装车单、可做单、已做单
    const rejected = serialized.rejected ?? false;
    const enabled = serialized.enabled ?? true;
    const verify_po = serialized.verify_po ?? false;
    const verify_loading_sheet = serialized.verify_loading_sheet ?? false;
    const can_create_sheet = serialized.can_create_sheet ?? false;
    const has_created_sheet = serialized.has_created_sheet ?? false;

    // Trailer：从 outbound_shipments 获取，如果没有出库记录则返回 null
    const trailer = serialized.outbound_shipments?.trailer_code || null;
    // 备注：与出库管理连通，优先显示出库单备注
    const notes = serialized.outbound_shipments?.notes ?? serialized.notes ?? null;

    // ETA：仅当派送方式为直送时，取第一个明细对应订单的 eta_date，否则为空
    let eta: string | null = null;
    if (deliveryMethod === '直送' && serialized.orders) {
      const orders = serialized.orders as { eta_date?: string | Date | null };
      const etaDate = orders?.eta_date;
      if (etaDate) {
        eta = typeof etaDate === 'string' ? etaDate.split('T')[0] : new Date(etaDate).toISOString().split('T')[0];
      }
    }

    return NextResponse.json({
      ...serialized,
      delivery_method: deliveryMethod,
      appointment_account: appointmentAccount,
      appointment_type: appointmentType,
      // 返回location_id用于表单字段绑定
      origin_location_id: originLocationId,
      location_id: destinationLocationId,
      // 返回location_code用于列表显示（而不是name）
      origin_location: originLocationCode,
      destination_location: destinationLocationCode,
      // 时间字段：转换为 PST/PDT 显示
      requested_start: requestedStart,
      requested_end: requestedEnd,
      confirmed_start: confirmedStart,
      confirmed_end: confirmedEnd,
      eta,
      total_pallets: totalPallets ?? 0,
      rejected: rejected,
      enabled,
      verify_po: verify_po,
      verify_loading_sheet: verify_loading_sheet,
      can_create_sheet: can_create_sheet,
      has_created_sheet: has_created_sheet,
      trailer: trailer, // 从 outbound_shipments 获取
      notes, // 与出库管理连通
    });
  } catch (error: any) {
    console.error('获取预约管理记录失败:', error);
    return handleError(error);
  }
}

// PUT - 更新预约管理记录
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    
    // 字段名映射：将前端可能发送的字段名映射到schema期望的字段名
    const mappedBody: any = { ...body }
    
    // 如果前端发送了origin_location，映射到origin_location_id
    if (mappedBody.origin_location !== undefined && mappedBody.origin_location_id === undefined) {
      // 转换为字符串（schema期望字符串类型）
      mappedBody.origin_location_id = String(mappedBody.origin_location)
      delete mappedBody.origin_location
    }
    // 如果origin_location_id是数字，转换为字符串
    if (mappedBody.origin_location_id !== undefined && typeof mappedBody.origin_location_id === 'number') {
      mappedBody.origin_location_id = String(mappedBody.origin_location_id)
    }
    
    // 如果前端发送了destination_location，映射到location_id
    if (mappedBody.destination_location !== undefined && mappedBody.location_id === undefined) {
      // 转换为字符串（schema期望字符串类型）
      mappedBody.location_id = String(mappedBody.destination_location)
      delete mappedBody.destination_location
    }
    // 如果location_id是数字，转换为字符串
    if (mappedBody.location_id !== undefined && typeof mappedBody.location_id === 'number') {
      mappedBody.location_id = String(mappedBody.location_id)
    }
    
    // 验证输入
    const validationResult = deliveryAppointmentUpdateSchema.safeParse(mappedBody);
    if (!validationResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[PUT /api/oms/appointments/[id]] 验证失败:', {
          issues: validationResult.error.issues,
          mappedBody: mappedBody,
          originalBody: body
        })
      }
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;
    
    // 检查登录
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;
    const appointmentId = BigInt(id);

    // 获取当前用户（用于审计字段）
    const currentUser = authResult;

    // 构建更新数据
    const updateData: any = {};
    
    if (data.reference_number !== undefined) {
      updateData.reference_number = data.reference_number;
    }
    if (data.order_id !== undefined) {
      updateData.order_id = data.order_id ? (typeof data.order_id === 'bigint' ? data.order_id : BigInt(data.order_id)) : null;
    }
    // 处理location_id（目的地）
    if (data.location_id !== undefined && data.location_id !== null && data.location_id !== '') {
      updateData.location_id = typeof data.location_id === 'bigint' ? data.location_id : BigInt(data.location_id);
    } else if (data.location_id === null || data.location_id === '') {
      // 如果明确传递了null或空字符串，设置为null
      updateData.location_id = null;
    }
    // 处理origin_location_id（起始地）
    if (data.origin_location_id !== undefined && data.origin_location_id !== null && data.origin_location_id !== '') {
      updateData.origin_location_id = typeof data.origin_location_id === 'bigint' ? data.origin_location_id : BigInt(data.origin_location_id);
    } else if (data.origin_location_id === null || data.origin_location_id === '') {
      // 如果明确传递了null或空字符串，设置为null
      updateData.origin_location_id = null;
    }
    
    if (data.appointment_type !== undefined) {
      updateData.appointment_type = data.appointment_type;
    }
    if (data.delivery_method !== undefined) {
      updateData.delivery_method = data.delivery_method;
    }
    if (data.appointment_account !== undefined) {
      updateData.appointment_account = data.appointment_account;
    }
    // 处理时间戳字段：不进行时区转换，直接使用原始值
    // 如果前端发送的是 YYYY-MM-DDTHH:mm 格式的字符串，手动解析为 Date 对象（不进行时区转换）
    // 导入时间解析函数（直接当作 UTC 时间处理，不做时区转换）
    const { parseDateTimeAsUTC } = await import('@/lib/utils/datetime-pst')
    
    const parseDateTimeWithoutTimezone = (value: string, ensureHourOnly: boolean = false): Date => {
      // 用户输入的时间直接当作 UTC 时间处理，不做任何时区转换
      // 格式：YYYY-MM-DDTHH:mm 或 YYYY-MM-DDTHH:mm:ss 或 YYYY-MM-DD（只有日期时自动添加时间 00:00）
      if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // 如果只有日期（YYYY-MM-DD），自动添加时间 00:00
        return parseDateTimeAsUTC(`${value}T00:00`)
      }
      const date = parseDateTimeAsUTC(value)
      // 如果 ensureHourOnly 为 true，确保分钟数、秒数、毫秒数都是0（用于送货时间，必须是整点）
      if (ensureHourOnly) {
        return new Date(Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          date.getUTCHours(), // 保留用户输入的小时数
          0, // 分钟数强制设为0
          0, // 秒数强制设为0
          0  // 毫秒数强制设为0
        ))
      }
      return date
    }
    
    if (data.requested_start !== undefined) {
      if (data.requested_start === null || data.requested_start === '') {
        updateData.requested_start = null;
      } else if (typeof data.requested_start === 'string') {
        updateData.requested_start = parseDateTimeWithoutTimezone(data.requested_start);
      } else {
        updateData.requested_start = data.requested_start;
      }
    }
    if (data.requested_end !== undefined) {
      if (data.requested_end === null || data.requested_end === '') {
        updateData.requested_end = null;
      } else if (typeof data.requested_end === 'string') {
        updateData.requested_end = parseDateTimeWithoutTimezone(data.requested_end);
      } else {
        updateData.requested_end = data.requested_end;
      }
    }
    if (data.confirmed_start !== undefined) {
      if (data.confirmed_start === null || data.confirmed_start === '') {
        updateData.confirmed_start = null;
      } else if (typeof data.confirmed_start === 'string') {
        // 送货时间必须是整点：保留用户输入的小时数，但将分钟数、秒数、毫秒数强制设为0
        // 使用UTC方法，不做任何时区转换
        updateData.confirmed_start = parseDateTimeWithoutTimezone(data.confirmed_start, true);
      } else {
        updateData.confirmed_start = data.confirmed_start;
      }
    }
    if (data.confirmed_end !== undefined) {
      if (data.confirmed_end === null || data.confirmed_end === '') {
        updateData.confirmed_end = null;
      } else if (typeof data.confirmed_end === 'string') {
        // 送货时间必须是整点：保留用户输入的小时数，但将分钟数、秒数、毫秒数强制设为0
        // 使用UTC方法，不做任何时区转换
        updateData.confirmed_end = parseDateTimeWithoutTimezone(data.confirmed_end, true);
      } else {
        updateData.confirmed_end = data.confirmed_end;
      }
    }
    
    // 处理 total_pallets：total_pallets 不在 delivery_appointments 表中
    // 它是从 orders.order_detail 计算出来的，所以不能直接更新
    // 如果需要修改板数，需要更新 order_detail 中的 estimated_pallets
    // 但这里我们暂时忽略 total_pallets 的更新，因为它是一个计算字段
    // 注意：total_pallets 现在在 validation schema 中，但这里我们忽略它
    if (data.total_pallets !== undefined) {
      // total_pallets 是计算字段，不能直接更新
      // 如果需要修改，需要更新 order_detail 中的 estimated_pallets
      // 这里我们暂时忽略
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.rejected !== undefined) {
      updateData.rejected = Boolean(data.rejected);
    }
    if (data.enabled !== undefined) {
      updateData.enabled = Boolean(data.enabled);
    }
    if (data.verify_po !== undefined) {
      updateData.verify_po = Boolean(data.verify_po);
    }
    if (data.verify_loading_sheet !== undefined) {
      updateData.verify_loading_sheet = Boolean(data.verify_loading_sheet);
    }
    if (data.can_create_sheet !== undefined) {
      updateData.can_create_sheet = Boolean(data.can_create_sheet);
    }
    if (data.has_created_sheet !== undefined) {
      updateData.has_created_sheet = Boolean(data.has_created_sheet);
    }
    if (data.po !== undefined) {
      updateData.po = data.po;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }
    const notesToSync = data.notes;

    // 应用系统字段
    const user = currentUser.user || null;
    const finalData = await addSystemFields(updateData, user, false);

    // 先获取原始记录，以判断 delivery_method 是否改变
    const originalItem = await prisma.delivery_appointments.findUnique({
      where: {
        appointment_id: BigInt(id),
      },
      select: {
        delivery_method: true,
        enabled: true,
      },
    });

    if (originalItem?.enabled === false && finalData.enabled !== true) {
      return NextResponse.json(
        { error: '该预约已停用，无法修改。如需恢复请将「启用」设为开启后保存。' },
        { status: 400 }
      );
    }

    const originalDeliveryMethod = originalItem?.delivery_method;
    const newDeliveryMethod = finalData.delivery_method !== undefined ? finalData.delivery_method : originalDeliveryMethod;

    // 更新记录
    const updatedItem = await prisma.delivery_appointments.update({
      where: {
        appointment_id: BigInt(id),
      },
      data: finalData,
      include: {
        orders: {
          select: {
            order_id: true,
            operation_mode: true,
          },
        },
        locations: {
          select: {
            location_id: true,
            name: true,
            location_code: true,
          },
        },
        locations_delivery_appointments_origin_location_idTolocations: {
          select: {
            location_id: true,
            name: true,
            location_code: true,
          },
        },
      },
    });

    // 备注与出库管理连通：若有出库单，同步更新出库单的 notes
    if (notesToSync !== undefined) {
      try {
        const os = await prisma.outbound_shipments.findFirst({
          where: { appointment_id: BigInt(id) },
          select: { outbound_shipment_id: true },
        });
        if (os) {
          await prisma.outbound_shipments.update({
            where: { outbound_shipment_id: os.outbound_shipment_id },
            data: { notes: notesToSync, updated_at: new Date(), updated_by: user?.id ? BigInt(user.id) : null },
          });
        }
      } catch (syncErr: any) {
        console.warn('同步预约备注到出库单失败:', syncErr);
      }
    }

    const serialized = serializeBigInt(updatedItem);
    
    // 导入时间格式化函数（直接显示 UTC 时间，不做时区转换）
    const { formatUTCDateTimeString } = await import('@/lib/utils/datetime-pst')
    
    // 格式化 location 字段
    const originLocationId = serialized.origin_location_id || null;
    const originLocationCode = serialized.locations_delivery_appointments_origin_location_idTolocations?.location_code || null;
    const destinationLocationId = serialized.location_id || null;
    const destinationLocationCode = serialized.locations?.location_code || null;
    
    // 时间字段：直接格式化 UTC 时间，不做时区转换
    const requestedStart = serialized.requested_start 
      ? formatUTCDateTimeString(serialized.requested_start) 
      : null
    const requestedEnd = serialized.requested_end 
      ? formatUTCDateTimeString(serialized.requested_end) 
      : null
    const confirmedStart = serialized.confirmed_start 
      ? formatUTCDateTimeString(serialized.confirmed_start) 
      : null
    const confirmedEnd = serialized.confirmed_end 
      ? formatUTCDateTimeString(serialized.confirmed_end) 
      : null

    // 同步订单的预约信息（如果有 order_id）
    if (updatedItem.orders?.order_id) {
      try {
        const { syncOrderAppointmentInfo } = await import('@/lib/services/sync-order-appointment-info')
        await syncOrderAppointmentInfo(updatedItem.orders.order_id)
      } catch (syncError: any) {
        console.warn('同步订单预约信息失败:', syncError)
        // 不影响预约更新，只记录警告
      }
    }

    // 处理 outbound_shipments 的自动同步
    // 检查 delivery_method 是否改变
    if (originalDeliveryMethod !== newDeliveryMethod) {
      if (newDeliveryMethod && newDeliveryMethod !== '直送') {
        // 从直送改为非直送，或新建非直送：创建 outbound_shipments 记录
        try {
          const defaultWarehouseId = BigInt(1000);
          // 先检查是否已存在（使用原始 SQL）
          const existing = await prisma.$queryRaw<Array<{ outbound_shipment_id: bigint }>>`
            SELECT outbound_shipment_id FROM wms.outbound_shipments WHERE appointment_id = ${appointmentId} LIMIT 1
          `;
          
          if (existing && existing.length > 0) {
            // 如果已存在，同步 updated_by、updated_at 和备注（与预约管理连通）
            await prisma.outbound_shipments.update({
              where: {
                outbound_shipment_id: existing[0].outbound_shipment_id,
              },
              data: {
                updated_by: user?.id ? BigInt(user.id) : null,
                updated_at: new Date(),
                notes: (updatedItem as any).notes ?? null,
              },
            });
          } else {
            // 如果不存在，创建新记录（使用原始 SQL）
            await prisma.$executeRaw`
              INSERT INTO wms.outbound_shipments (warehouse_id, appointment_id, status, created_at, updated_at, created_by, updated_by)
              VALUES (${defaultWarehouseId}, ${appointmentId}, 'planned', NOW(), NOW(), ${user?.id ? BigInt(user.id) : null}, ${user?.id ? BigInt(user.id) : null})
              ON CONFLICT (appointment_id) DO NOTHING
            `;
            await prisma.outbound_shipments.updateMany({
              where: { appointment_id: appointmentId },
              data: { notes: (updatedItem as any).notes ?? null },
            });
          }
        } catch (outboundError: any) {
          console.warn('自动创建/更新 outbound_shipments 记录失败:', outboundError);
        }
      } else if (newDeliveryMethod === '直送') {
        // 从非直送改为直送：删除 outbound_shipments 记录
        try {
          await prisma.$executeRaw`
            DELETE FROM wms.outbound_shipments WHERE appointment_id = ${appointmentId}
          `;
        } catch (outboundError: any) {
          console.warn('自动删除 outbound_shipments 记录失败:', outboundError);
        }
      }
    } else if (newDeliveryMethod && newDeliveryMethod !== '直送') {
      // delivery_method 没有改变，但仍然是非直送：确保 outbound_shipments 记录存在
      try {
        const defaultWarehouseId = BigInt(1000);
        // 先检查是否已存在（使用原始 SQL）
        const existing = await prisma.$queryRaw<Array<{ outbound_shipment_id: bigint }>>`
          SELECT outbound_shipment_id FROM wms.outbound_shipments WHERE appointment_id = ${appointmentId} LIMIT 1
        `;
        
        if (existing && existing.length > 0) {
          // 如果已存在，同步 updated_by、updated_at 和备注
          await prisma.outbound_shipments.update({
            where: {
              outbound_shipment_id: existing[0].outbound_shipment_id,
            },
            data: {
              updated_by: user?.id ? BigInt(user.id) : null,
              updated_at: new Date(),
              notes: (updatedItem as any).notes ?? null,
            },
          });
        } else {
          // 如果不存在，创建新记录（使用原始 SQL）
          await prisma.$executeRaw`
            INSERT INTO wms.outbound_shipments (warehouse_id, appointment_id, status, created_at, updated_at, created_by, updated_by)
            VALUES (${defaultWarehouseId}, ${appointmentId}, 'planned', NOW(), NOW(), ${user?.id ? BigInt(user.id) : null}, ${user?.id ? BigInt(user.id) : null})
            ON CONFLICT (appointment_id) DO NOTHING
          `;
          await prisma.outbound_shipments.updateMany({
            where: { appointment_id: appointmentId },
            data: { notes: (updatedItem as any).notes ?? null },
          });
        }
      } catch (outboundError: any) {
        console.warn('确保 outbound_shipments 记录存在失败:', outboundError);
      }
    }

    // 补建送仓管理行（历史孤儿或曾创建失败时，与 outbound 同步后再对齐 1:1）
    const { ensureDeliveryManagementRow } = await import('@/lib/services/ensure-delivery-management')
    await ensureDeliveryManagementRow(prisma, {
      appointment_id: appointmentId,
      delivery_method: updatedItem.delivery_method ?? null,
      order_id: updatedItem.order_id ?? null,
      updated_by: user?.id ? BigInt(user.id) : null,
    })

    // 确保返回三个 Boolean 字段
    const verify_loading_sheet = serialized.verify_loading_sheet ?? false;
    const can_create_sheet = serialized.can_create_sheet ?? false;
    const has_created_sheet = serialized.has_created_sheet ?? false;
    const rejected = serialized.rejected ?? false;
    const enabled = serialized.enabled ?? true;

    return NextResponse.json({
      success: true,
      message: '更新成功',
      data: {
        ...serialized,
        // 返回location_id用于表单字段绑定
        origin_location_id: originLocationId,
        location_id: destinationLocationId,
        // 返回location_code用于列表显示（而不是name）
        origin_location: originLocationCode,
        destination_location: destinationLocationCode,
        // 时间字段：转换为 PST/PDT 显示
        requested_start: requestedStart,
        requested_end: requestedEnd,
        confirmed_start: confirmedStart,
        confirmed_end: confirmedEnd,
        // 确保返回三个 Boolean 字段
        verify_loading_sheet: verify_loading_sheet,
        can_create_sheet: can_create_sheet,
        has_created_sheet: has_created_sheet,
        rejected: rejected,
        enabled,
      }
    });
  } catch (error: any) {
    console.error('更新预约管理记录失败:', error);
    if (process.env.NODE_ENV === 'development') {
      console.error('[PUT /api/oms/appointments/[id]] 错误详情:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        meta: error.meta,
        name: error.name
      })
    }
    return handleError(error);
  }
}

// DELETE - 删除预约管理记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await checkPermission(
      deliveryAppointmentConfig.permissions.delete
    );
    if (permissionResult.error) return permissionResult.error;

    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;
    const appointmentId = BigInt(id);

    // 使用 AppointmentDeleteService 处理删除（自动回退板数）
    const { AppointmentDeleteService } = await import('@/lib/services/appointment-delete.service');
    await AppointmentDeleteService.deleteAppointment(appointmentId);

    return NextResponse.json({ message: '预约已停用，剩余板数已回退' });
  } catch (error: any) {
    console.error('删除预约管理记录失败:', error);
    return handleError(error);
  }
}

