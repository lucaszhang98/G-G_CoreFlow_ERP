"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface BackButtonProps {
  fallbackUrl?: string // 如果没有历史记录，返回到这个URL
  variant?: "default" | "ghost" | "outline" | "secondary" | "destructive" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

/**
 * 返回按钮组件
 * 
 * 优先使用浏览器的后退功能（保留URL参数），如果没有历史记录则返回到fallbackUrl
 */
export function BackButton({ 
  fallbackUrl, 
  variant = "ghost", 
  size = "icon",
  className 
}: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    // 检查是否有浏览器历史记录
    if (typeof window !== 'undefined' && window.history.length > 1) {
      // 使用浏览器后退，保留所有URL参数
      router.back()
    } else if (fallbackUrl) {
      // 如果没有历史记录且提供了fallbackUrl，导航到fallbackUrl
      router.push(fallbackUrl)
    } else {
      // 否则使用浏览器后退（即使没有历史记录）
      router.back()
    }
  }

  return (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleBack}
      className={className}
      aria-label="返回"
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  )
}

