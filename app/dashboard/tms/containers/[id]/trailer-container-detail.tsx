"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface TrailerContainerDetailProps {
  container: any
}

export function TrailerContainerDetail({ container }: TrailerContainerDetailProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>拖车容器详情</CardTitle>
        <CardDescription>容器ID: {container.container_id}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">拖车容器详情功能待开发</p>
      </CardContent>
    </Card>
  )
}


