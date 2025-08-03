import { useEffect } from 'react'
import { useAddNotification } from '../store'

export function GlobalErrorHandler() {
  const addNotification = useAddNotification()

  useEffect(() => {
    // 捕获未处理的Promise拒绝
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
      
      let errorMessage = '发生了未知错误'
      
      if (event.reason?.message) {
        errorMessage = event.reason.message
      } else if (typeof event.reason === 'string') {
        errorMessage = event.reason
      } else if (event.reason?.error) {
        errorMessage = event.reason.error
      }
      
      addNotification({
        type: 'error',
        title: '系统错误',
        message: errorMessage,
      })
      
      // 阻止默认的控制台错误输出
      event.preventDefault()
    }

    // 捕获JavaScript运行时错误
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error)
      
      let errorMessage = event.message || '发生了未知错误'
      
      // 过滤掉一些不重要的错误
      if (
        errorMessage.includes('ResizeObserver loop limit exceeded') ||
        errorMessage.includes('Non-Error promise rejection captured') ||
        errorMessage.includes('Script error')
      ) {
        return
      }
      
      addNotification({
        type: 'error',
        title: 'JavaScript错误',
        message: errorMessage,
      })
    }

    // 添加事件监听器
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    // 清理函数
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [addNotification])

  return null // 这个组件不渲染任何内容
}