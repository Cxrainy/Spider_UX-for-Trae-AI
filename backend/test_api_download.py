#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试API文件下载功能
"""

import requests
import json

def test_api_download():
    """测试API下载功能"""
    base_url = "http://localhost:5000/api"
    
    # 测试爬虫ID（使用已存在的爬虫）
    spider_ids = [3, 4]
    
    for spider_id in spider_ids:
        print(f"\n=== 测试爬虫 {spider_id} 的文件下载API ===")
        
        # 1. 获取爬虫文件列表
        try:
            response = requests.get(f"{base_url}/spiders/{spider_id}/files")
            if response.status_code == 200:
                data = response.json()
                files = data.get('files', [])
                print(f"找到 {len(files)} 个文件:")
                
                for file_info in files:
                    filename = file_info['filename']
                    file_id = file_info['id']
                    exists = file_info.get('exists', False)
                    
                    print(f"  - {filename} (ID: {file_id}, 存在: {exists})")
                    
                    if exists:
                        # 2. 测试通过filename下载
                        download_url = f"{base_url}/spiders/{spider_id}/files/download?filename={filename}"
                        print(f"    API下载链接: {download_url}")
                        
                        try:
                            download_response = requests.get(download_url)
                            if download_response.status_code == 200:
                                print(f"    ✓ 通过filename下载成功 (大小: {len(download_response.content)} bytes)")
                            else:
                                print(f"    ✗ 通过filename下载失败: {download_response.status_code} - {download_response.text}")
                        except Exception as e:
                            print(f"    ✗ 下载请求异常: {e}")
                        
                        # 3. 测试通过file_id下载（对比）
                        id_download_url = f"{base_url}/spiders/{spider_id}/files/{file_id}/download"
                        try:
                            id_download_response = requests.get(id_download_url)
                            if id_download_response.status_code == 200:
                                print(f"    ✓ 通过file_id下载成功 (大小: {len(id_download_response.content)} bytes)")
                            else:
                                print(f"    ✗ 通过file_id下载失败: {id_download_response.status_code}")
                        except Exception as e:
                            print(f"    ✗ ID下载请求异常: {e}")
                    else:
                        print(f"    - 文件不存在于磁盘，跳过下载测试")
                        
            else:
                print(f"获取文件列表失败: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"请求异常: {e}")
    
    # 4. 测试错误情况
    print(f"\n=== 测试错误情况 ===")
    
    # 测试不存在的文件
    test_url = f"{base_url}/spiders/3/files/download?filename=nonexistent.txt"
    try:
        response = requests.get(test_url)
        print(f"不存在文件测试: {response.status_code} - {response.json().get('error', 'Unknown error')}")
    except Exception as e:
        print(f"不存在文件测试异常: {e}")
    
    # 测试缺少filename参数
    test_url = f"{base_url}/spiders/3/files/download"
    try:
        response = requests.get(test_url)
        print(f"缺少filename参数测试: {response.status_code} - {response.json().get('error', 'Unknown error')}")
    except Exception as e:
        print(f"缺少filename参数测试异常: {e}")
    
    # 测试不存在的爬虫
    test_url = f"{base_url}/spiders/999/files/download?filename=test.txt"
    try:
        response = requests.get(test_url)
        print(f"不存在爬虫测试: {response.status_code} - {response.json().get('error', 'Unknown error')}")
    except Exception as e:
        print(f"不存在爬虫测试异常: {e}")

if __name__ == "__main__":
    print("开始测试API文件下载功能...")
    test_api_download()
    print("\n测试完成！")