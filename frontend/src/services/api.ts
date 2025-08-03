import axios from 'axios'

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证token等
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    // 统一错误处理
    let message = '请求失败'
    let details = ''
    
    if (error.response?.data?.error) {
      // 后端返回的错误信息
      message = error.response.data.error
    } else if (error.response?.data?.message) {
      // 备用错误信息字段
      message = error.response.data.message
    } else if (error.message) {
      // axios错误信息
      message = error.message
    }
    
    // 提取详细错误信息
    if (error.response?.data?.details) {
      details = error.response.data.details
    } else if (error.response?.data?.type) {
      details = `错误类型: ${error.response.data.type}`
    }
    
    // 创建增强的错误对象，保留原始响应数据
    const enhancedError = new Error(message)
    enhancedError.response = error.response
    enhancedError.status = error.response?.status
    enhancedError.details = details
    enhancedError.error = message
    
    // 添加网络错误的特殊处理
    if (error.code === 'NETWORK_ERROR' || error.code === 'ERR_NETWORK') {
      enhancedError.message = '网络连接失败，请检查网络连接'
    } else if (error.code === 'ECONNABORTED') {
      enhancedError.message = '请求超时，请稍后重试'
    }
    
    return Promise.reject(enhancedError)
  }
)

export default api

// 类型定义
export interface Spider {
  id: number
  name: string
  description: string
  code: string
  status: 'inactive' | 'running' | 'stopped' | 'error' | 'success'
  created_at: string
  updated_at: string
  last_run_at?: string
  run_count: number
  success_count: number
  error_count: number
  total_runs: number
  successful_runs: number
  config: Record<string, any>
}

export interface SpiderLog {
  id: number
  spider_id: number
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG'
  message: string
  timestamp: string
  source?: string
  execution_id?: string
}

export interface SpiderFile {
  id: number
  spider_id: number
  filename: string
  file_path: string
  file_type: string
  file_size: number
  file_size_human: string
  size: number
  created_at: string
  description?: string
  tags: string[]
  execution_id?: string
  exists: boolean
}

export interface PaginatedResponse<T> {
  items?: T[]
  spiders?: T[]
  logs?: T[]
  files?: T[]
  total: number
  pages: number
  current_page: number
  per_page: number
}

export interface LogStatistics {
  total_logs: number
  level_distribution: Record<string, number>
  source_distribution: Record<string, number>
  daily_logs: Array<{ date: string; count: number }>
}

export interface FileStatistics {
  total_size: number
  total_size_human: string
  file_types: Record<string, number>
}

export interface Schedule {
  id: string
  name: string
  next_run_time?: string
  trigger: string
  trigger_type: string
  args: any[]
  kwargs: Record<string, any>
  misfire_grace_time: number
  max_instances: number
}

export interface SpiderStatus {
  spider_id: number
  status: string
  runtime_info: {
    is_running: boolean
    execution_id?: string
    start_time?: string
    duration?: number
    current_step?: string
  }
  last_run_at?: string
  run_count: number
  success_count: number
  error_count: number
  execution_id?: string
  start_time?: string
  duration?: number
}