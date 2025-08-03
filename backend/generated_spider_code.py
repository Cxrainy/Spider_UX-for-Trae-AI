
import os
import sys
import json
import requests
from datetime import datetime
from pathlib import Path

# 爬虫运行环境变量
SPIDER_ID = 3
EXECUTION_ID = "test-execution-id"
OUTPUT_DIR = os.environ.get('OUTPUT_DIR', '.')

# 工具函数
def log_message(level, message):
    """记录日志"""
    timestamp = datetime.now().isoformat()
    print(f"[{timestamp}] [{level}] {message}")

def save_data(data, filename, format='json'):
    """保存数据到文件"""
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    try:
        if format == 'json':
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        elif format == 'csv':
            import pandas as pd
            if isinstance(data, list) and len(data) > 0:
                df = pd.DataFrame(data)
                df.to_csv(filepath, index=False, encoding='utf-8')
            else:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(str(data))
        else:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(str(data))
        
        log_message('INFO', f'Data saved to {{filename}}')
        return filepath
    except Exception as e:
        log_message('ERROR', f'Failed to save data to {{filename}}: {{e}}')
        return None

def get_config():
    """获取爬虫配置"""
    return json.loads('"{}"')

# 用户爬虫代码开始
try:
    log_message('INFO', 'Spider execution started')
    
    # 用户代码开始
    import requests
    from bs4 import BeautifulSoup
    import time
    import csv

    def get_movie_info(div):
        title = div.find('span', class_='title').text
        info = div.find('div', class_='bd').find('p').text.strip().replace('\n', ' ')
        rating = div.find('span', class_='rating_num').text
        quote = div.find('span', class_='inq').text if div.find('span', class_='inq') else ""
        return [title, info, rating, quote]

    def scrape_douban_top250():
        movies = []
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        }
        for start in range(0, 250, 25):
            url = f'https://movie.douban.com/top250?start={start}'
            response = requests.get(url, headers=headers)
            if response.status_code != 200:
                print(f'Failed to fetch page {start // 25 + 1}')
                continue
            soup = BeautifulSoup(response.text, 'html.parser')
            items = soup.find_all('div', class_='item')
            for item in items:
                movies.append(get_movie_info(item))
            print(f'Page {start // 25 + 1} scraped.')
            time.sleep(2)  # 避免被封禁

        # 保存为CSV文件
        with open('douban_top250.csv', 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['标题', '信息', '评分', '短评'])
            writer.writerows(movies)
        print('已保存至 douban_top250.csv')

    if __name__ == '__main__':
        scrape_douban_top250()
    
    log_message('INFO', 'Spider execution completed successfully')
except Exception as e:
    import traceback
    error_msg = f'Spider execution failed: {{{{str(e)}}}}'
    traceback_msg = traceback.format_exc()
    
    log_message('ERROR', error_msg)
    log_message('ERROR', f'Detailed traceback:\n{{{{traceback_msg}}}}')
    
    # 输出到stderr以便被spider_runner捕获
    print(f'ERROR: {{{{error_msg}}}}', file=sys.stderr)
    print(f'TRACEBACK:\n{{{{traceback_msg}}}}', file=sys.stderr)
    
    sys.exit(1)
