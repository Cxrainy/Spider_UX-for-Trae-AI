import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Bug,
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '../ui/button'
import { useSidebar } from '../../store'
import { cn } from '../../lib/utils'

const navigation = [
  {
    name: '仪表盘',
    href: '/',
    icon: Home,
  },
  {
    name: '爬虫列表',
    href: '/spiders',
    icon: Bug,
  },
  {
    name: '创建爬虫',
    href: '/spiders/create',
    icon: Plus,
  },
  {
    name: '设置',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const location = useLocation()
  const { isCollapsed, toggle } = useSidebar()

  return (
    <div
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <Bug className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Spider UX</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="h-8 w-8"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                isCollapsed ? 'justify-center' : 'justify-start'
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className={cn('h-5 w-5', !isCollapsed && 'mr-3')} />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t p-4">
          <div className="text-xs text-muted-foreground">
            <p>Spider UX v1.0.0</p>
            <p>可视化爬虫管理系统</p>
          </div>
        </div>
      )}
    </div>
  )
}