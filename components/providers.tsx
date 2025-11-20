"use client"

import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="h-full">
        {children}
      </div>
      <Toaster position="top-right" richColors />
    </SessionProvider>
  )
}

