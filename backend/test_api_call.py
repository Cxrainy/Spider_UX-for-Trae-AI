#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试规则爬虫API调用功能
"""

import requests
import json
import time

def test_spider_api_call():
    """测试爬虫API调用"""
    base_url = 'http://localhost:5000/api'
    spider_id = 5  # 使用ID为5的规则爬虫
    
    print(f"开始测试爬虫 {spider_id} 的API调用功能...")
    
    try:
        # 1. 首先获取爬虫信息
        print("\n1. 获取爬虫信息...")
        response = requests.get(f'{base_url}/spiders/{spider_id}')
        if response.status_code == 200:
            spider_info = response.json()
            print(f"爬虫名称: {spider_info['name']}")
            print(f"爬虫类型: {spider_info.get('config', {}).get('type', 'unknown')}")
        else:
            print(f"获取爬虫信息失败: {response.status_code}")
            return
        
        # 2. 调用API接口
        print("\n2. 调用爬虫API接口...")
        start_time = time.time()
        
        response = requests.post(f'{base_url}/spiders/{spider_id}/api-call')
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        print(f"请求耗时: {execution_time:.2f}秒")
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("\n=== API调用成功 ===")
            print(f"成功状态: {result.get('success')}")
            print(f"爬虫ID: {result.get('spider_id')}")
            print(f"爬虫名称: {result.get('spider_name')}")
            print(f"数据条数: {result.get('count')}")
            print(f"目标URL: {result.get('url')}")
            print(f"执行时间: {result.get('execution_time', 0):.2f}秒")
            print(f"消息: {result.get('message')}")
            
            # 显示前3条数据
            data = result.get('data', [])
            if data:
                print("\n=== 前3条数据示例 ===")
                for i, item in enumerate(data[:3]):
                    print(f"第{i+1}条: {json.dumps(item, ensure_ascii=False, indent=2)}")
            else:
                print("\n未获取到数据")
                
        elif response.status_code == 400:
            result = response.json()
            print("\n=== API调用失败 ===")
            print(f"错误信息: {result.get('error')}")
            print(f"爬虫ID: {result.get('spider_id')}")
            print(f"爬虫名称: {result.get('spider_name')}")
            print(f"执行时间: {result.get('execution_time', 0):.2f}秒")
        else:
            print(f"\n请求失败: {response.status_code}")
            print(f"响应内容: {response.text}")
        
        # 3. 检查爬虫状态
        print("\n3. 检查爬虫状态...")
        response = requests.get(f'{base_url}/spiders/{spider_id}/status')
        if response.status_code == 200:
            status_info = response.json()
            print(f"爬虫状态: {status_info.get('status')}")
            print(f"运行次数: {status_info.get('run_count')}")
            print(f"成功次数: {status_info.get('success_count')}")
            print(f"错误次数: {status_info.get('error_count')}")
            print(f"最后运行时间: {status_info.get('last_run_at')}")
        
        # 4. 检查日志
        print("\n4. 检查最新日志...")
        response = requests.get(f'{base_url}/spiders/{spider_id}/logs?limit=5')
        if response.status_code == 200:
            logs_response = response.json()
            if isinstance(logs_response, list):
                logs = logs_response
            else:
                logs = logs_response.get('logs', [])
            
            print(f"最新5条日志:")
            for log in logs[:5]:
                print(f"  [{log.get('level')}] {log.get('message')} ({log.get('timestamp')})")
        
    except requests.exceptions.ConnectionError:
        print("连接失败: 请确保后端服务器正在运行 (http://localhost:5000)")
    except Exception as e:
        print(f"测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()

def test_multiple_calls():
    """测试多次API调用"""
    base_url = 'http://localhost:5000/api'
    spider_id = 5
    
    print(f"\n\n=== 测试多次API调用 ===")
    
    for i in range(3):
        print(f"\n第{i+1}次调用:")
        try:
            start_time = time.time()
            response = requests.post(f'{base_url}/spiders/{spider_id}/api-call')
            end_time = time.time()
            
            print(f"  耗时: {end_time - start_time:.2f}秒")
            print(f"  状态码: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"  成功: {result.get('success')}")
                print(f"  数据条数: {result.get('count')}")
            else:
                result = response.json()
                print(f"  失败: {result.get('error')}")
                
        except Exception as e:
            print(f"  错误: {e}")
        
        # 间隔1秒
        if i < 2:
            time.sleep(1)

if __name__ == '__main__':
    print("规则爬虫API调用功能测试")
    print("=" * 50)
    
    # 基本功能测试
    test_spider_api_call()
    
    # 多次调用测试
    test_multiple_calls()
    
    print("\n测试完成!")