/**
 * 通用实体详情页客户端组件
 * 提供编辑功能
 */

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Edit } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EntityForm } from "./entity-form"
import { EntityConfig } from "@/lib/crud/types"

interface EntityDetailClientProps {
  config: EntityConfig
  data: any
}

export function EntityDetailClient({ config, data }: EntityDetailClientProps) {
  const router = useRouter()
  const [openDialog, setOpenDialog] = React.useState(false)

  const handleFormSuccess = () => {
    setOpenDialog(false)
    router.refresh() // 刷新页面以显示更新后的数据
  }

  return (
    <>
      <Button 
        variant="outline" 
        size="icon"
        onClick={() => setOpenDialog(true)}
        title="编辑"
        className="h-8 w-8"
      >
        <Edit className="h-4 w-4" />
      </Button>

      {/* 编辑对话框 */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑{config.displayName}</DialogTitle>
            <DialogDescription>
              修改{config.displayName}信息
            </DialogDescription>
          </DialogHeader>
          <EntityForm
            config={config}
            data={data}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setOpenDialog(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

