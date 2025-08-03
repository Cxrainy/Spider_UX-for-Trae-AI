#!/usr/bin/env python3
from database import get_db

db = get_db()

# 检查爬虫3的文件
print('=== Spider 3 Files ===')
files = db.get_spider_files(3)
print(f'Total files found: {len(files)}')
for f in files:
    print(f'ID: {f["id"]}, Name: {f["filename"]}, Path: {f["file_path"]}, Exists: {f.get("exists", "unknown")}')

print('\n=== Spider 4 Files ===')
files = db.get_spider_files(4)
print(f'Total files found: {len(files)}')
for f in files:
    print(f'ID: {f["id"]}, Name: {f["filename"]}, Path: {f["file_path"]}, Exists: {f.get("exists", "unknown")}')

# 检查数据库表结构
print('\n=== Database Table Info ===')
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(spider_files)")
    columns = cursor.fetchall()
    print('spider_files table columns:')
    for col in columns:
        print(f'  {col[1]} ({col[2]})')
    
    # 检查所有文件记录
    cursor.execute("SELECT COUNT(*) FROM spider_files")
    total_files = cursor.fetchone()[0]
    print(f'\nTotal files in database: {total_files}')
    
    cursor.execute("SELECT spider_id, COUNT(*) FROM spider_files GROUP BY spider_id")
    files_by_spider = cursor.fetchall()
    print('Files by spider:')
    for spider_id, count in files_by_spider:
        print(f'  Spider {spider_id}: {count} files')