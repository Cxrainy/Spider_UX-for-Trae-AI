#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sqlite3
from datetime import datetime, timedelta
import random
from database import get_db

def create_test_data():
    """创建测试数据用于图表展示"""
    db = get_db()
    
    # 创建一些测试爬虫（如果不存在）
    test_spiders = [
        {'name': '测试爬虫1', 'description': '用于测试的爬虫1', 'code': 'print("test1")'},
        {'name': '测试爬虫2', 'description': '用于测试的爬虫2', 'code': 'print("test2")'},
        {'name': '测试爬虫3', 'description': '用于测试的爬虫3', 'code': 'print("test3")'},
    ]
    
    spider_ids = []
    for spider_data in test_spiders:
        try:
            spider_id = db.create_spider(
                name=spider_data['name'],
                description=spider_data['description'],
                code=spider_data['code']
            )
            spider_ids.append(spider_id)
            print(f"创建爬虫: {spider_data['name']} (ID: {spider_id})")
        except Exception as e:
            # 爬虫可能已存在，获取现有ID
            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT id FROM spiders WHERE name = ?', (spider_data['name'],))
                result = cursor.fetchone()
                if result:
                    spider_ids.append(result[0])
                    print(f"爬虫已存在: {spider_data['name']} (ID: {result[0]})")
    
    # 生成过去24小时的测试日志数据
    now = datetime.now()
    
    with db.get_connection() as conn:
        cursor = conn.cursor()
        
        # 清除现有测试日志
        cursor.execute('DELETE FROM spider_logs WHERE spider_id IN ({})'.format(','.join('?' * len(spider_ids))), spider_ids)
        
        # 生成每小时的日志数据
        for hour_offset in range(24):
            hour_time = now - timedelta(hours=hour_offset)
            
            # 每小时随机生成1-5次运行
            runs_this_hour = random.randint(1, 5)
            
            for run in range(runs_this_hour):
                spider_id = random.choice(spider_ids)
                execution_id = f"exec_{hour_time.strftime('%Y%m%d_%H')}_{run}"
                
                # 运行开始日志
                start_time = hour_time + timedelta(minutes=random.randint(0, 59))
                cursor.execute('''
                    INSERT INTO spider_logs (spider_id, level, message, timestamp, execution_id)
                    VALUES (?, ?, ?, ?, ?)
                ''', (spider_id, 'INFO', f'爬虫开始运行 - 执行ID: {execution_id}', start_time.isoformat(), execution_id))
                
                # 随机决定是否成功（80%成功率）
                is_success = random.random() < 0.8
                
                # 运行结束日志
                end_time = start_time + timedelta(minutes=random.randint(1, 30))
                if is_success:
                    cursor.execute('''
                        INSERT INTO spider_logs (spider_id, level, message, timestamp, execution_id)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (spider_id, 'INFO', f'爬虫运行完成 - 执行ID: {execution_id} - completed', end_time.isoformat(), execution_id))
                else:
                    cursor.execute('''
                        INSERT INTO spider_logs (spider_id, level, message, timestamp, execution_id)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (spider_id, 'ERROR', f'爬虫运行失败 - 执行ID: {execution_id} - error', end_time.isoformat(), execution_id))
        
        conn.commit()
        print(f"已生成过去24小时的测试日志数据")
    
    print("测试数据创建完成！")

if __name__ == '__main__':
    create_test_data()