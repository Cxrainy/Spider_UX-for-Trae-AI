#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db

def create_test_spider():
    """创建一个会产生错误的测试爬虫"""
    db = get_db()
    
    # 创建一个会产生错误的爬虫代码
    error_code = '''
print("Starting test spider...")
print("This will cause an error:")

# 这行代码会产生NameError
print(undefined_variable)

print("This line will not be reached")
'''
    
    spider_id = db.create_spider(
        name="测试错误爬虫",
        description="用于测试错误日志记录的爬虫",
        code=error_code,
        config={}
    )
    
    print(f"Test spider created with ID: {spider_id}")
    return spider_id

if __name__ == '__main__':
    create_test_spider()