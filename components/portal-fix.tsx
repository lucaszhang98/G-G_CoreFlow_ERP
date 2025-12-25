"use client"

import { useEffect } from "react"

/**
 * 修复 Next.js Portal 定位问题
 * 当 portal 元素有负值定位时，自动重置为 0
 */
export function PortalFix() {
  useEffect(() => {
    // 确保在浏览器环境中运行
    if (typeof window === "undefined" || typeof document === "undefined") {
      return
    }

    const fixPortalPosition = () => {
      try {
        // 查找所有 nextjs-portal 元素
        const portals = document.querySelectorAll("nextjs-portal")
        
        portals.forEach((portal) => {
          try {
            const element = portal as HTMLElement
            if (!element || !element.style) return
            
            const style = element.style
            
            // 检查并修复负值定位
            if (style.left) {
              const leftValue = parseInt(style.left, 10)
              if (!isNaN(leftValue) && leftValue < 0) {
                style.left = "0px"
              }
            }
            
            if (style.top) {
              const topValue = parseInt(style.top, 10)
              if (!isNaN(topValue) && topValue < 0) {
                style.top = "0px"
              }
            }
          } catch (error) {
            // 忽略单个元素的错误，继续处理其他元素
            console.debug("Portal fix error for element:", error)
          }
        })
      } catch (error) {
        // 忽略整体错误，避免影响应用运行
        console.debug("Portal fix error:", error)
      }
    }
    
    // 延迟执行，确保 DOM 已加载
    const timeoutId = setTimeout(() => {
      fixPortalPosition()
    }, 100)
    
    // 使用 MutationObserver 监听 DOM 变化
    let observer: MutationObserver | null = null
    
    try {
      observer = new MutationObserver(() => {
        fixPortalPosition()
      })
      
      // 观察整个文档的变化
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style"],
        })
      }
    } catch (error) {
      console.debug("Failed to create MutationObserver:", error)
    }
    
    // 清理函数
    return () => {
      clearTimeout(timeoutId)
      if (observer) {
        observer.disconnect()
      }
    }
  }, [])
  
  return null
}









