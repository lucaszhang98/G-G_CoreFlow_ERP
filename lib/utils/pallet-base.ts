/**
 * 用于未约板数、剩余板数、送货进度等公式的「基准板数」：
 * 实际板数为 0 时按预计板数计算（尚未录入实际板数时避免用 0 导致未约为负、进度 100% 等异常）。
 */
export function basePalletCountForCalc(
  palletCount: number | null | undefined,
  estimatedPallets: number | null | undefined
): number {
  const pc = palletCount ?? 0
  if (pc === 0) {
    return estimatedPallets ?? 0
  }
  return pc
}
