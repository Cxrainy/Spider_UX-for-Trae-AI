#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db

def check_latest_logs():
    """检查最新的爬虫日志"""
    db = get_db()
    
    # 获取爬虫4的最新执行日志（测试错误爬虫）
    spider_id = 4
    
    # 获取最新的execution_id
    logs = db.get_spider_logs(spider_id, limit=50)
    
    if not logs:
        print("No logs found")
        return
    
    print(f"Latest logs for spider {spider_id}:")
    print("=" * 80)
    
    # 按时间排序显示日志
    for log in logs:
        print(f"[{log['timestamp']}] [{log['level']}] [{log['source']}] {log['message']}")
    
    print("=" * 80)
    print(f"Total logs: {len(logs)}")

if __name__ == '__main__':
    check_latest_logs()