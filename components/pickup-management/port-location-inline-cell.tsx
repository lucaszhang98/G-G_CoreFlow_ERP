"use client"

import * as React from "react"
import { LocationSelect } from "@/components/ui/location-select"
import { cn } from "@/lib/utils"

export type PortLocationDraft = {
  port_location_id: string | null
  displayCode: string
  original_port_location_id: string | null
}

export type PortLocationRow = {
  pickup_id: string | number
  port_location_id?: string | null
  port_location?: string | null
}

/**
 * 提柜列表「码头/查验站」：仅改本页草稿，点「保存码头修改」写入订单 port_location_id
 */
export function PortLocationInlineCell({
  row,
  draft,
  onEnsureDraft,
  onDraftChange,
}: {
  row: PortLocationRow
  draft: PortLocationDraft | null
  onEnsureDraft: () => void
  onDraftChange: (next: PortLocationDraft) => void
}) {
  const [editing, setEditing] = React.useState(false)

  const displayId = draft?.port_location_id ?? row.port_location_id ?? null
  const displayCode =
    draft?.displayCode ??
    (row.port_location != null && String(row.port_location).trim() !== ""
      ? String(row.port_location)
      : "—")

  const dirty =
    draft != null &&
    String(draft.port_location_id ?? "") !== String(draft.original_port_location_id ?? "")

  const handleLocationChange = React.useCallback(
    async (value: string | number | null) => {
      let displayCodeNext = "—"
      let idNext: string | null = null
      if (value != null && value !== "") {
        idNext = String(value)
        try {
          const res = await fetch(`/api/locations/${idNext}`)
          if (res.ok) {
            const raw = await res.json()
            const loc = raw?.data ?? raw
            displayCodeNext =
              (loc?.location_code != null && String(loc.location_code).trim() !== ""
                ? String(loc.location_code)
                : null) ??
              (loc?.name != null ? String(loc.name) : null) ??
              idNext
          } else {
            displayCodeNext = idNext
          }
        } catch {
          displayCodeNext = idNext
        }
      }
      onDraftChange({
        port_location_id: idNext,
        displayCode: displayCodeNext,
        original_port_location_id:
          draft?.original_port_location_id ??
          (row.port_location_id != null ? String(row.port_location_id) : null),
      })
      setEditing(false)
    },
    [draft?.original_port_location_id, onDraftChange, row.port_location_id]
  )

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEnsureDraft()
    setEditing(true)
  }

  if (editing) {
    return (
      <div className="min-w-[10rem] max-w-[18rem]" onClick={(e) => e.stopPropagation()}>
        <LocationSelect
          value={displayId}
          onChange={handleLocationChange}
          locationType="port"
          placeholder="选择码头/查验站"
          className="h-8 min-h-8 text-xs w-full"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        "w-full text-left text-xs rounded px-1 py-0.5 -mx-1 min-h-7 truncate",
        "hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
        dirty && "text-amber-800 dark:text-amber-300 font-medium"
      )}
      title="点击选择码头/查验站（需点「保存码头修改」写入数据库）"
      onClick={startEdit}
    >
      {displayCode}
      {dirty ? <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">待保存</span> : null}
    </button>
  )
}
