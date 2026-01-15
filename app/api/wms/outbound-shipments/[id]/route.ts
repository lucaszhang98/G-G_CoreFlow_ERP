import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';

// GET - 获取单个出库管理记录（通过 appointment_id）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // 检查登录
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    
    const resolvedParams = params instanceof Promise ? await params : params;
    const appointmentId = resolvedParams.id;

    if (!appointmentId || isNaN(Number(appointmentId))) {
      return NextResponse.json(
        { error: '无效的预约ID' },
        { status: 400 }
      );
    }

    // 查询 delivery_appointment
    const appointment = await prisma.delivery_appointments.findUnique({
      where: { appointment_id: BigInt(appointmentId) },
      include: {
        orders: {
          select: {
            order_id: true,
            status: true,
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
            location_code: true,
          },
        },
        locations_delivery_appointments_origin_location_idTolocations: {
          select: {
            location_id: true,
            location_code: true,
          },
        },
        outbound_shipments: {
          select: {
            outbound_shipment_id: true,
            trailer_id: true,
            loaded_by: true,
            notes: true,
            users_outbound_shipments_loaded_byTousers: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: '预约记录不存在' },
        { status: 404 }
      );
    }

    // 检查订单状态（只显示非直送）
    if (appointment.orders?.status === 'direct_delivery') {
      return NextResponse.json(
        { error: '直送订单不在出库管理范围内' },
        { status: 400 }
      );
    }

    const serialized = serializeBigInt(appointment);
    const outboundShipment = serialized.outbound_shipments || null;
    
    // 计算总板数
    let totalPallets = 0;
    if (serialized.orders?.order_detail && Array.isArray(serialized.orders.order_detail)) {
      totalPallets = serialized.orders.order_detail.reduce((sum: number, detail: any) => {
        return sum + (detail.estimated_pallets || 0);
      }, 0);
    }

    return NextResponse.json({
      // 从 delivery_appointments 获取的字段
      appointment_id: serialized.appointment_id.toString(),
      reference_number: serialized.reference_number || null,
      delivery_method: serialized.delivery_method || null,
      rejected: serialized.rejected || false,
      appointment_account: serialized.appointment_account || null,
      appointment_type: serialized.appointment_type || null,
      origin_location: serialized.locations_delivery_appointments_origin_location_idTolocations?.location_code || null,
      destination_location: serialized.locations?.location_code || null,
      confirmed_start: serialized.confirmed_start || null,
      total_pallets: totalPallets,
      
      // 从 outbound_shipments 获取的字段（如果存在）
      outbound_shipment_id: outboundShipment ? outboundShipment.outbound_shipment_id.toString() : null,
      trailer_id: outboundShipment?.trailer_id ? outboundShipment.trailer_id.toString() : null,
      trailer_code: outboundShipment?.trailer_code || null, // 直接使用 outbound_shipments.trailer_code
      loaded_by: outboundShipment?.loaded_by ? outboundShipment.loaded_by.toString() : null,
      loaded_by_name: outboundShipment?.users_outbound_shipments_loaded_byTousers?.full_name || null,
      notes: outboundShipment?.notes || null,
      
      // 关联对象（用于 relation 类型字段的显示）
      users_outbound_shipments_loaded_byTousers: outboundShipment?.users_outbound_shipments_loaded_byTousers || null,
    });
  } catch (error: any) {
    console.error('获取出库管理记录失败:', error);
    return handleError(error);
  }
}

// PUT - 更新出库管理记录（只允许修改 trailer_id, loaded_by, notes）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
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

    // 允许修改 trailer_code, loaded_by, notes, rejected
    const updateData: any = {};
    
    if (body.trailer_code !== undefined) {
      // trailer_code 直接保存为文本
      updateData.trailer_code = body.trailer_code || null;
    }
    if (body.loaded_by !== undefined || body.loaded_by_name !== undefined) {
      // 支持 loaded_by 或 loaded_by_name（前端可能传 loaded_by_name，需要转换为 loaded_by）
      // 前端发送的是字符串格式的用户ID，需要转换为 BigInt
      const loadedById = body.loaded_by || body.loaded_by_name
      console.log(`[OutboundShipments] 接收 loaded_by 字段:`, { loaded_by: body.loaded_by, loaded_by_name: body.loaded_by_name, loadedById, type: typeof loadedById })
      if (loadedById) {
        // 处理字符串或数字格式的ID
        if (typeof loadedById === 'string' && loadedById.trim() !== '') {
          try {
            updateData.loaded_by = BigInt(loadedById.trim())
            console.log(`[OutboundShipments] 转换 loaded_by 成功: "${loadedById.trim()}" -> BigInt(${updateData.loaded_by.toString()})`)
          } catch (error: any) {
            console.error(`[OutboundShipments] 转换 loaded_by 失败:`, error, { loadedById })
            updateData.loaded_by = null
          }
        } else if (typeof loadedById === 'number' || typeof loadedById === 'bigint') {
          updateData.loaded_by = BigInt(loadedById)
          console.log(`[OutboundShipments] 转换 loaded_by 成功: ${loadedById} -> BigInt(${updateData.loaded_by.toString()})`)
        } else {
          console.warn(`[OutboundShipments] loaded_by 值格式不正确:`, typeof loadedById, loadedById)
          updateData.loaded_by = null
        }
      } else {
        updateData.loaded_by = null
        console.log(`[OutboundShipments] loaded_by 为空，设置为 null`)
      }
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }

    // rejected 字段在 delivery_appointments 表中，需要单独更新
    const appointmentUpdateData: any = {}
    if (body.rejected !== undefined) {
      appointmentUpdateData.rejected = Boolean(body.rejected)
    }

    // 检查 delivery_appointment 是否存在且非直送
    const appointment = await prisma.delivery_appointments.findUnique({
      where: { appointment_id: BigInt(appointmentId) },
      include: {
        orders: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: '预约记录不存在' },
        { status: 404 }
      );
    }

    if (appointment.orders?.status === 'direct_delivery') {
      return NextResponse.json(
        { error: '直送订单不在出库管理范围内' },
        { status: 400 }
      );
    }

    // 检查 outbound_shipment 是否存在，如果不存在则创建
    let outboundShipment = await prisma.outbound_shipments.findUnique({
      where: { appointment_id: BigInt(appointmentId) },
    });

    // 记录旧的 trailer_code，用于判断是否需要更新 delivery_management
    const oldTrailerCode = (outboundShipment as any)?.trailer_code

    if (!outboundShipment) {
      // 自动创建 outbound_shipment
      // 需要 warehouse_id，这里使用默认值或从配置获取
      // 暂时使用 1 作为默认值，实际应该从配置或上下文获取
      const defaultWarehouseId = BigInt(1);
      
      const createData: any = {
        appointment_id: BigInt(appointmentId),
        warehouse_id: defaultWarehouseId,
        trailer_code: updateData.trailer_code || null,
        loaded_by: updateData.loaded_by || null,
        notes: updateData.notes || null,
      };
      
      const finalCreateData = await addSystemFields(createData, user, true);
      
      // 使用类型断言，因为 Prisma Client 可能还没有识别到 trailer_code 字段
      outboundShipment = await prisma.outbound_shipments.create({
        data: finalCreateData as any,
        include: {
          users_outbound_shipments_loaded_byTousers: {
            select: {
              id: true,
              full_name: true,
              username: true,
            },
          },
        },
      });
    } else {
      // 更新现有记录
      console.log(`[OutboundShipments] 更新前 updateData:`, JSON.stringify(updateData, null, 2))
      const finalUpdateData = await addSystemFields(updateData, user, false);
      console.log(`[OutboundShipments] 更新前 finalUpdateData:`, JSON.stringify(finalUpdateData, null, 2))
      
      // 使用事务同时更新 outbound_shipments 和 delivery_appointments
      const result = await prisma.$transaction(async (tx) => {
        // 更新 outbound_shipments
        // 使用类型断言，因为 Prisma Client 可能还没有识别到 trailer_code 字段
        console.log(`[OutboundShipments] 执行数据库更新，data:`, JSON.stringify(finalUpdateData, null, 2))
        const updated = await tx.outbound_shipments.update({
          where: { appointment_id: BigInt(appointmentId) },
          data: finalUpdateData as any,
          include: {
            users_outbound_shipments_loaded_byTousers: {
              select: {
                id: true,
                full_name: true,
                username: true,
              },
            },
          },
        });
        console.log(`[OutboundShipments] 数据库更新后，loaded_by:`, updated.loaded_by?.toString(), `loaded_by_name:`, updated.users_outbound_shipments_loaded_byTousers?.full_name)

        // 更新 delivery_appointments.rejected（如果有）
        if (Object.keys(appointmentUpdateData).length > 0) {
          await tx.delivery_appointments.update({
            where: { appointment_id: BigInt(appointmentId) },
            data: appointmentUpdateData,
          });
        }

        return updated;
      });

      outboundShipment = result;

      // 如果 trailer_code 发生变化，自动更新 delivery_management.container_number
      // 需要重新查询以获取更新后的 trailer_code（因为事务返回的数据可能不包含所有字段）
      if (body.trailer_code !== undefined) {
        // 重新查询以获取最新的 trailer_code
        const refreshedOutboundShipment = await prisma.outbound_shipments.findUnique({
          where: { appointment_id: BigInt(appointmentId) },
          select: { trailer_code: true } as any,
        });
        const newTrailerCode = (refreshedOutboundShipment as any)?.trailer_code || body.trailer_code || null
        // 只有当新值不为空且与旧值不同时才更新
        if (newTrailerCode && newTrailerCode !== oldTrailerCode) {
          try {
            // 查找对应的 delivery_management 记录
            const deliveryManagement = await prisma.delivery_management.findUnique({
              where: { appointment_id: BigInt(appointmentId) },
            })

            if (deliveryManagement) {
              // 获取 appointment 的 delivery_method，确认是卡派或自提
              const appointmentForUpdate = await prisma.delivery_appointments.findUnique({
                where: { appointment_id: BigInt(appointmentId) },
                select: { delivery_method: true },
              })

              // 只有卡派或自提才更新 container_number
              if (appointmentForUpdate?.delivery_method === '卡派' || appointmentForUpdate?.delivery_method === '自提') {
                await prisma.delivery_management.update({
                  where: { delivery_id: deliveryManagement.delivery_id },
                  data: { container_number: newTrailerCode } as any,
                })
                console.log(`[OutboundShipments] 自动更新送仓管理柜号: appointment_id=${appointmentId}, container_number=${newTrailerCode}`)
              }
            }
          } catch (error: any) {
            console.error('[OutboundShipments] 自动更新送仓管理柜号失败:', error)
            // 不抛出错误，因为主要操作（更新 outbound_shipments）已经成功
          }
        } else if (!newTrailerCode && oldTrailerCode) {
          // 如果新值为空但旧值不为空，也需要更新（清空）
          try {
            const deliveryManagement = await prisma.delivery_management.findUnique({
              where: { appointment_id: BigInt(appointmentId) },
            })

            if (deliveryManagement) {
              const appointmentForUpdate = await prisma.delivery_appointments.findUnique({
                where: { appointment_id: BigInt(appointmentId) },
                select: { delivery_method: true },
              })

              if (appointmentForUpdate?.delivery_method === '卡派' || appointmentForUpdate?.delivery_method === '自提') {
                await prisma.delivery_management.update({
                  where: { delivery_id: deliveryManagement.delivery_id },
                  data: { container_number: null } as any,
                })
                console.log(`[OutboundShipments] 清空送仓管理柜号: appointment_id=${appointmentId}`)
              }
            }
          } catch (error: any) {
            console.error('[OutboundShipments] 清空送仓管理柜号失败:', error)
          }
        }
      }
    }

    // 重新查询以获取完整的关联数据用于返回
    const finalOutboundShipment = await prisma.outbound_shipments.findUnique({
      where: { appointment_id: BigInt(appointmentId) },
      select: {
        outbound_shipment_id: true,
        trailer_id: true,
        trailer_code: true,
        loaded_by: true,
        notes: true,
        users_outbound_shipments_loaded_byTousers: {
          select: {
            id: true,
            full_name: true,
            username: true,
          },
        },
      } as any,
    });
    console.log(`[OutboundShipments] 最终查询结果 - loaded_by:`, (finalOutboundShipment as any)?.loaded_by?.toString(), `loaded_by_name:`, (finalOutboundShipment as any)?.users_outbound_shipments_loaded_byTousers?.full_name)

    if (!finalOutboundShipment) {
      return NextResponse.json(
        { error: '出库管理记录不存在' },
        { status: 404 }
      );
    }

    // 获取 appointment 信息用于返回
    const appointmentForResponse = await prisma.delivery_appointments.findUnique({
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
    
    let totalPallets = 0;
    if (appointmentForResponse?.appointment_detail_lines && Array.isArray(appointmentForResponse.appointment_detail_lines)) {
      totalPallets = appointmentForResponse.appointment_detail_lines.reduce((sum: number, line: any) => {
        return sum + (line.estimated_pallets || 0);
      }, 0);
    }

    return NextResponse.json({
      data: {
        // 从 delivery_appointments 获取的字段
        appointment_id: appointmentForResponse?.appointment_id.toString() || appointmentId,
        reference_number: appointmentForResponse?.reference_number || null,
        delivery_method: appointmentForResponse?.delivery_method || null,
        rejected: appointmentForResponse?.rejected || false,
        appointment_account: appointmentForResponse?.appointment_account || null,
        appointment_type: appointmentForResponse?.appointment_type || null,
        origin_location: appointmentForResponse?.locations_delivery_appointments_origin_location_idTolocations?.location_code || null,
        destination_location: appointmentForResponse?.locations?.location_code || null,
        confirmed_start: appointmentForResponse?.confirmed_start || null,
        total_pallets: totalPallets,
        
        // 从 outbound_shipments 获取的字段
        outbound_shipment_id: finalOutboundShipment.outbound_shipment_id.toString(),
        trailer_id: finalOutboundShipment.trailer_id ? finalOutboundShipment.trailer_id.toString() : null,
        trailer_code: (finalOutboundShipment as any).trailer_code || null,
        loaded_by: finalOutboundShipment.loaded_by ? finalOutboundShipment.loaded_by.toString() : null,
        loaded_by_name: finalOutboundShipment.users_outbound_shipments_loaded_byTousers?.full_name || null,
        notes: finalOutboundShipment.notes || null,
        
        // 关联对象（用于 relation 类型字段的显示）
        users_outbound_shipments_loaded_byTousers: finalOutboundShipment.users_outbound_shipments_loaded_byTousers 
          ? serializeBigInt(finalOutboundShipment.users_outbound_shipments_loaded_byTousers) 
          : null,
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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return NextResponse.json(
    { error: '出库管理记录不能删除，它们与预约管理记录关联' },
    { status: 405 }
  );
}
