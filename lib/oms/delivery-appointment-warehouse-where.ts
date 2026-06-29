export function buildDeliveryAppointmentWarehouseWhere(warehouseId: bigint) {
  return {
    OR: [
      { orders: { warehouse_id: warehouseId } },
      {
        appointment_detail_lines: {
          some: {
            order_detail: {
              orders: { warehouse_id: warehouseId },
            },
          },
        },
      },
      {
        locations_delivery_appointments_origin_location_idTolocations: {
          warehouse_id: warehouseId,
        },
      },
      { locations: { warehouse_id: warehouseId } },
    ],
  }
}
