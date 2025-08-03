import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Layout } from './components/layout/Layout'
import { Toaster } from './components/ui/toaster'
import { GlobalErrorHandler } from './components/GlobalErrorHandler'
import { Dashboard } from './pages/Dashboard'
import { SpiderList } from './pages/SpiderList'
import { SpiderDetail } from './pages/SpiderDetail'
import { SpiderForm } from './pages/SpiderForm'
import { Settings } from './pages/Settings'
import { initializeStore } from './store'
import './index.css'

// 创建 React Query 客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5分钟
    },
    mutations: {
      retry: 1,
    },
  },
})

function App() {
  useEffect(() => {
    // 初始化应用状态
    initializeStore()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background font-sans antialiased">
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* 仪表盘 */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* 爬虫管理 */}
            <Route path="spiders" element={<SpiderList />} />
            <Route path="spiders/create" element={<SpiderForm />} />
            <Route path="spiders/:id" element={<SpiderDetail />} />
            <Route path="spiders/:id/edit" element={<SpiderForm />} />
            
            {/* 设置 */}
            <Route path="settings" element={<Settings />} />
            
            {/* 404 页面 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        
        {/* 全局通知 */}
        <Toaster />
        
        {/* 全局错误处理 */}
        <GlobalErrorHandler />
      </div>
      
      {/* React Query 开发工具 */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

// 404 页面组件
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="text-6xl font-bold text-muted-foreground mb-4">404</div>
      <h1 className="text-2xl font-semibold mb-2">页面未找到</h1>
      <p className="text-muted-foreground mb-6">
        抱歉，您访问的页面不存在。
      </p>
      <div className="space-x-4">
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 text-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md"
        >
          返回上页
        </button>
        <a
          href="/dashboard"
          className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md inline-block"
        >
          回到首页
        </a>
      </div>
    </div>
  )
}

export default App