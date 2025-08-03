import axios from 'axios'

const API_BASE_URL = 'http://localhost:5000/api'

export interface SystemStats {
  cpu_percent: number
  memory_percent: number
  timestamp: string
}

export interface SpiderHourlyStats {
  hour: string
  run_count: number
  success_count: number
  success_rate: number
}

export interface SpiderStatsSummary {
  total_run_count: number
  total_success_count: number
  overall_success_rate: number
}

export interface SpiderStatsResponse {
  stats: SpiderHourlyStats[]
  summary: SpiderStatsSummary
}

export const monitorService = {
  // 获取系统资源使用情况
  getSystemStats: async (): Promise<SystemStats> => {
    const response = await axios.get(`${API_BASE_URL}/monitor/system`)
    return response.data.data
  },

  // 获取爬虫运行统计数据
  getSpiderStats: async (): Promise<SpiderHourlyStats[]> => {
    const response = await axios.get(`${API_BASE_URL}/monitor/spider-stats`)
    return response.data.data
  },

  // 获取单个爬虫的运行统计数据
  getSingleSpiderStats: async (spiderId: number): Promise<SpiderHourlyStats[]> => {
    const response = await axios.get(`${API_BASE_URL}/monitor/spider/${spiderId}/stats`)
    return response.data.data
  },
}