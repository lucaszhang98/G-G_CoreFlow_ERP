"use client"

import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"
import { PortalFix } from "./portal-fix"

// 如果 PortalFix 导致问题，可以设置为 false 来禁用它
const ENABLE_PORTAL_FIX = true

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* PortalFix 修复 nextjs-portal 定位问题 */}
      {ENABLE_PORTAL_FIX && <PortalFix />}
      <div className="h-full">
        {children}
      </div>
      <Toaster position="top-right" richColors />
    </SessionProvider>
  )
}

