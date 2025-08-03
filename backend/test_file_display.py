#!/usr/bin/env python3
import requests
import json

# 测试文件显示修复
print('=== 测试文件显示修复 ===')

try:
    # 测试获取爬虫3的文件
    response = requests.get('http://localhost:5000/api/spiders/3/files')
    if response.status_code == 200:
        data = response.json()
        print(f'Spider 3 files API response:')
        print(f'Total files: {len(data.get("files", []))}')
        
        for file in data.get('files', []):
            print(f'\nFile ID: {file["id"]}')
            print(f'Name: {file["filename"]}')
            print(f'Path: {file["file_path"]}')
            print(f'Exists: {file.get("exists", "unknown")}')
            print(f'Absolute Path: {file.get("absolute_path", "not set")}')
    else:
        print(f'Error getting spider 3 files: {response.status_code}')
        print(response.text)
        
    print('\n' + '='*50)
    
    # 测试获取爬虫4的文件
    response = requests.get('http://localhost:5000/api/spiders/4/files')
    if response.status_code == 200:
        data = response.json()
        print(f'Spider 4 files API response:')
        print(f'Total files: {len(data.get("files", []))}')
        
        for file in data.get('files', []):
            print(f'\nFile ID: {file["id"]}')
            print(f'Name: {file["filename"]}')
            print(f'Path: {file["file_path"]}')
            print(f'Exists: {file.get("exists", "unknown")}')
            print(f'Absolute Path: {file.get("absolute_path", "not set")}')
    else:
        print(f'Error getting spider 4 files: {response.status_code}')
        print(response.text)
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()