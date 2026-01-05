"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function TestClipboardPage() {
  const [result, setResult] = useState<string>("")
  const testText = "测试复制内容"

  const testClipboardAPI = async () => {
    try {
      await navigator.clipboard.writeText(testText)
      setResult("✅ Clipboard API 成功")
    } catch (error: any) {
      setResult(`❌ Clipboard API 失败: ${error.message}`)
    }
  }

  const testExecCommand = () => {
    const textarea = document.createElement('textarea')
    textarea.value = testText
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    
    try {
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      setResult(success ? "✅ execCommand 成功" : "❌ execCommand 失败")
    } catch (error: any) {
      document.body.removeChild(textarea)
      setResult(`❌ execCommand 错误: ${error.message}`)
    }
  }

  const testContextMenu = () => {
    setResult("请在下方文本上右键点击...")
  }

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(testText)
      setResult("✅ 右键上下文中 Clipboard API 成功")
    } catch (error: any) {
      setResult(`❌ 右键上下文中 Clipboard API 失败: ${error.message}`)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">剪贴板权限测试</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold mb-2">浏览器信息：</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm">
            {`User Agent: ${navigator.userAgent}
Clipboard API: ${navigator.clipboard ? '支持' : '不支持'}
Secure Context: ${window.isSecureContext ? '是' : '否'}
Protocol: ${window.location.protocol}`}
          </pre>
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold">测试方法：</h2>
          <Button onClick={testClipboardAPI} className="mr-2">
            测试 Clipboard API
          </Button>
          <Button onClick={testExecCommand} className="mr-2">
            测试 execCommand
          </Button>
          <Button onClick={testContextMenu}>
            测试右键菜单
          </Button>
        </div>

        <div
          className="bg-blue-100 p-4 rounded cursor-context-menu"
          onContextMenu={handleContextMenu}
        >
          右键点击这里测试右键上下文中的复制
        </div>

        {result && (
          <div className="bg-yellow-50 p-4 rounded">
            <strong>结果：</strong> {result}
          </div>
        )}

        <div className="bg-gray-50 p-4 rounded text-sm">
          <h3 className="font-semibold mb-2">可能的问题：</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>浏览器更新导致权限策略变化</li>
            <li>localhost 的 Clipboard API 权限被浏览器限制</li>
            <li>需要在 HTTPS 环境下才能使用 Clipboard API</li>
            <li>浏览器扩展或安全软件阻止了剪贴板访问</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

