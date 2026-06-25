/**
 * 拆柜日期自动更新锁定规则：
 * - 已指定拆柜人员（unloaded_by）：禁止一切自动改写 planned_unload_at
 * - 其他状态（含已打印/已入库/已到仓）仍随提柜/ETA、查验/封闭区联动更新
 * - 手动传 planned_unload_at 始终允许
 */

export function inboundPlannedUnloadAtLockedByUnloadedBy(
  unloadedBy: bigint | null | undefined
): boolean {
  return unloadedBy != null
}

/** 是否禁止自动改拆柜日（仅看拆柜人员） */
export function isInboundPlannedUnloadAtAutoUpdateBlocked(
  unloadedBy: bigint | null | undefined
): boolean {
  return inboundPlannedUnloadAtLockedByUnloadedBy(unloadedBy)
}

/** 提柜/ETA 触发的常规重算是否应跳过（与查验联动相同，仅看拆柜人员） */
export function isInboundNormalPlannedUnloadRecalcBlocked(
  unloadedBy: bigint | null | undefined
): boolean {
  return inboundPlannedUnloadAtLockedByUnloadedBy(unloadedBy)
}

/** 本次保存是否携带拆柜人员字段（用于与库内值合并判断锁定） */
export function resolveEffectiveInboundUnloadedBy(args: {
  stored: bigint | null | undefined
  inRequest: string | null | undefined
}): bigint | null {
  if (args.inRequest === undefined) {
    return args.stored ?? null
  }
  if (!args.inRequest) {
    return null
  }
  return BigInt(args.inRequest)
}

export type InboundPlannedUnloadAtUpdatePolicy = {
  unloadedBy: bigint | null | undefined
  /** 请求中是否显式包含 planned_unload_at（手动改拆柜日期） */
  manualPlannedUnloadAtInRequest: boolean
}

/**
 * 从入库 update 对象中移除非手动的 planned_unload_at（已填拆柜人员时）。
 */
export function guardInboundPlannedUnloadAtInUpdate<
  T extends { planned_unload_at?: unknown },
>(updateData: T, policy: InboundPlannedUnloadAtUpdatePolicy): T {
  if (!isInboundNormalPlannedUnloadRecalcBlocked(policy.unloadedBy)) {
    return updateData
  }
  if (policy.manualPlannedUnloadAtInRequest) {
    return updateData
  }
  if (!('planned_unload_at' in updateData)) {
    return updateData
  }
  const { planned_unload_at: _removed, ...rest } = updateData
  return rest as T
}
