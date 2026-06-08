/**
 * 复制文本到剪贴板。优先 Clipboard API，失败时回退到 execCommand。
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  const value = text.trim()
  if (!value) {
    throw new Error('没有可复制的内容')
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // 部分浏览器或非 HTTPS 环境会拒绝 Clipboard API，继续回退
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('当前环境不支持复制')
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    const ok = document.execCommand('copy')
    if (!ok) throw new Error('execCommand 复制失败')
  } finally {
    document.body.removeChild(textarea)
  }
}
