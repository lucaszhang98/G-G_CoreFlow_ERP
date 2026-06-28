"use client"

import { useEffect, useState } from "react"

export type CurrentWarehouseInfo = {
  loading: boolean
  /** 'all' 表示全部仓库（仅 admin）；否则为仓库 id 字符串 */
  currentWarehouseId: string | null
  isAll: boolean
  /** 当前是否为默认仓 OAK(GG) */
  isDefaultWarehouse: boolean
  /** 当前是否为「某个非 OAK 的具体仓库」 */
  isOtherWarehouse: boolean
}

/**
 * 客户端读取「当前仓库」上下文。
 * 用于按仓控制 UI（如：非 OAK 仓隐藏邮件助手、显示订单批量导入）。
 */
export function useCurrentWarehouse(): CurrentWarehouseInfo {
  const [state, setState] = useState<CurrentWarehouseInfo>({
    loading: true,
    currentWarehouseId: null,
    isAll: false,
    isDefaultWarehouse: false,
    isOtherWarehouse: false,
  })

  useEffect(() => {
    let active = true
    fetch("/api/warehouse/current")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) {
          if (active) setState((s) => ({ ...s, loading: false }))
          return
        }
        const isAll = !!d.isAll
        const isDefaultWarehouse = !!d.isDefaultWarehouse
        setState({
          loading: false,
          currentWarehouseId: d.currentWarehouseId ?? null,
          isAll,
          isDefaultWarehouse,
          isOtherWarehouse: !isAll && !isDefaultWarehouse,
        })
      })
      .catch(() => {
        if (active) setState((s) => ({ ...s, loading: false }))
      })
    return () => {
      active = false
    }
  }, [])

  return state
}
