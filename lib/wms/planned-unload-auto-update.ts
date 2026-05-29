/**
 * 已指定拆柜人员（unloaded_by）时，禁止一切自动改写 planned_unload_at；
 * 仅当请求体显式传入 planned_unload_at 时视为手动修改拆柜日期。
 */

export function inboundPlannedUnloadAtLockedByUnloadedBy(
  unloadedBy: bigint | null | undefined
): boolean {
  return unloadedBy != null
}

export function isInboundPlannedUnloadAtAutoUpdateBlocked(
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
  if (!isInboundPlannedUnloadAtAutoUpdateBlocked(policy.unloadedBy)) {
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
