#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试API调用频率限制功能
"""

import requests
import json
import time
from datetime import datetime

def test_rate_limit():
    """测试API调用频率限制"""
    base_url = 'http://localhost:5000/api'
    spider_id = 5  # 使用ID为5的规则爬虫
    
    print(f"开始测试爬虫 {spider_id} 的API调用频率限制功能...")
    print("=" * 60)
    
    try:
        # 第一次调用 - 应该成功
        print("\n1. 第一次API调用（应该成功）...")
        response = requests.post(f'{base_url}/spiders/{spider_id}/api-call')
        
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"成功: {result.get('success')}")
            print(f"数据条数: {result.get('count')}")
            print(f"执行时间: {result.get('execution_time'):.2f}秒")
        else:
            result = response.json()
            print(f"失败: {result.get('error')}")
            print(f"详细信息: {json.dumps(result, indent=2, ensure_ascii=False)}")
        
        # 立即进行第二次调用 - 应该被限制
        print("\n2. 立即进行第二次API调用（应该被频率限制）...")
        response = requests.post(f'{base_url}/spiders/{spider_id}/api-call')
        
        print(f"状态码: {response.status_code}")
        if response.status_code == 429:
            result = response.json()
            print("✓ 频率限制正常工作！")
            print(f"错误信息: {result.get('error')}")
            print(f"提示信息: {result.get('message')}")
            print(f"剩余等待时间: {result.get('retry_after'):.1f}秒")
            print(f"下次可用时间: {result.get('next_available_time')}")
            
            # 测试等待一小段时间后再次调用
            wait_time = 10  # 等待10秒
            print(f"\n3. 等待 {wait_time} 秒后再次调用（仍应被限制）...")
            time.sleep(wait_time)
            
            response = requests.post(f'{base_url}/spiders/{spider_id}/api-call')
            print(f"状态码: {response.status_code}")
            
            if response.status_code == 429:
                result = response.json()
                print("✓ 频率限制仍然有效！")
                print(f"提示信息: {result.get('message')}")
                print(f"剩余等待时间: {result.get('retry_after'):.1f}秒")
            else:
                print("⚠ 意外：频率限制可能失效")
                
        elif response.status_code == 200:
            print("⚠ 警告：第二次调用成功了，频率限制可能没有生效")
            result = response.json()
            print(f"成功: {result.get('success')}")
        else:
            result = response.json()
            print(f"其他错误: {result.get('error')}")
        
        # 检查爬虫状态
        print("\n4. 检查爬虫状态...")
        response = requests.get(f'{base_url}/spiders/{spider_id}/status')
        if response.status_code == 200:
            status = response.json()
            print(f"运行次数: {status.get('run_count')}")
            print(f"最后运行时间: {status.get('last_run_at')}")
        
    except requests.exceptions.ConnectionError:
        print("连接失败: 请确保后端服务器正在运行 (http://localhost:5000)")
    except Exception as e:
        print(f"测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()

def test_rate_limit_with_different_intervals():
    """测试不同时间间隔的API调用"""
    base_url = 'http://localhost:5000/api'
    spider_id = 5
    
    print("\n\n=== 测试不同时间间隔的API调用 ===")
    
    intervals = [1, 30, 60, 120]  # 1秒, 30秒, 1分钟, 2分钟
    
    for i, interval in enumerate(intervals):
        print(f"\n第{i+1}次调用 (间隔{interval}秒):")
        
        if i > 0:
            print(f"等待 {interval} 秒...")
            time.sleep(interval)
        
        try:
            start_time = time.time()
            response = requests.post(f'{base_url}/spiders/{spider_id}/api-call')
            end_time = time.time()
            
            print(f"  请求耗时: {end_time - start_time:.2f}秒")
            print(f"  状态码: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"  ✓ 成功: 数据条数 {result.get('count')}")
            elif response.status_code == 429:
                result = response.json()
                print(f"  ⏰ 被限制: {result.get('message')}")
                print(f"  剩余等待: {result.get('retry_after'):.1f}秒")
            else:
                result = response.json()
                print(f"  ❌ 错误: {result.get('error')}")
                
        except Exception as e:
            print(f"  ❌ 异常: {e}")

if __name__ == '__main__':
    print("API调用频率限制功能测试")
    print("=" * 60)
    
    # 基本频率限制测试
    test_rate_limit()
    
    # 不同间隔测试
    test_rate_limit_with_different_intervals()
    
    print("\n测试完成!")
    print("\n注意: 如果要完全测试5分钟限制，需要等待5分钟后再次调用API")