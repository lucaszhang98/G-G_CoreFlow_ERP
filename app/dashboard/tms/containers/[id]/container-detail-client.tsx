"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SeaContainerDetail } from "./sea-container-detail"
import { TrailerContainerDetail } from "./trailer-container-detail"

interface ContainerDetailClientProps {
  container: any
}

export function ContainerDetailClient({ container }: ContainerDetailClientProps) {
  // 根据容器类型显示不同的详情内容
  if (container.source_type === 'sea_container') {
    return <SeaContainerDetail container={container} />
  } else if (container.source_type === 'company_trailer') {
    return <TrailerContainerDetail container={container} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>容器信息</CardTitle>
        <CardDescription>容器类型: {container.source_type}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">暂不支持此类型的容器详情显示</p>
      </CardContent>
    </Card>
  )
}


