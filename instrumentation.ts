/**
 * Next.js 启动时加载。仅吞掉 Z_DATA_ERROR（Node zlib 解压异常），避免进程崩。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (err: Error) => {
      const e = err as Error & { code?: string; errno?: number }
      if (e?.code === 'Z_DATA_ERROR' || e?.errno === -3 || e?.message?.includes('incorrect data check')) {
        console.warn('[instrumentation] 忽略 Z_DATA_ERROR')
        return
      }
      throw err
    })
  }
}
