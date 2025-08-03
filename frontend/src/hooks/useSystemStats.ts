import { useState, useEffect, useRef } from 'react'

interface SystemStats {
  cpu_percent: number
  memory_percent: number
  timestamp: string
}

interface SystemStatsHistory {
  timestamp: string
  cpu_percent: number
  memory_percent: number
}

// 模拟获取系统资源数据的函数
const getSystemResourcesFromBrowser = (): SystemStats => {
  // 使用随机数模拟CPU和内存使用率
  // 在实际应用中，这里可以使用Web API或其他方式获取真实数据
  const cpu_percent = Math.random() * 100
  const memory_percent = Math.random() * 100
  
  return {
    cpu_percent,
    memory_percent,
    timestamp: new Date().toISOString()
  }
}

export function useSystemStats(intervalMs: number = 2000) {
  const [currentStats, setCurrentStats] = useState<SystemStats | null>(null)
  const [history, setHistory] = useState<SystemStatsHistory[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // 立即获取一次数据
    const updateStats = () => {
      const stats = getSystemResourcesFromBrowser()
      setCurrentStats(stats)
      
      setHistory(prev => {
        const newHistory = [...prev, stats]
        // 只保留最近30个数据点（约1分钟的数据）
        return newHistory.slice(-30)
      })
    }

    updateStats()

    // 设置定时器
    intervalRef.current = setInterval(updateStats, intervalMs)

    // 清理函数
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [intervalMs])

  return {
    currentStats,
    history
  }
}