/**
 * 订单明细「分仓占比」与订单详情页一致：按各明细 volume 占全单合计体积（%）。
 * 用于账单同步等场景：当库字段 volume_percentage 未维护时回退计算。
 */

/** 解析 order_detail.volume（含 Prisma Decimal） */
export function parseOrderDetailVolume(volume: unknown): number {
  if (volume === null || volume === undefined) return 0
  if (typeof volume === 'object' && volume !== null && 'toString' in volume) {
    return parseFloat(String((volume as { toString(): string }).toString())) || 0
  }
  if (typeof volume === 'string') return parseFloat(volume) || 0
  return Number(volume) || 0
}

/** 按体积合计计算每条明细的分仓占比（%），key 为 order_detail.id 字符串 */
export function volumePercentageFromVolumesByDetailId(
  details: Array<{ id: bigint; volume: unknown }>
): Map<string, number> {
  const total = details.reduce((sum, d) => sum + parseOrderDetailVolume(d.volume), 0)
  const map = new Map<string, number>()
  if (total <= 0) return map
  for (const d of details) {
    const v = parseOrderDetailVolume(d.volume)
    if (v > 0) {
      map.set(d.id.toString(), parseFloat(((v / total) * 100).toFixed(2)))
    }
  }
  return map
}
