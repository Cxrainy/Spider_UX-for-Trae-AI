# 可视化爬虫管理系统

一个基于Flask后端和React前端的可视化爬虫管理系统。

## 功能特性

- 🕷️ 爬虫创建、编辑和管理
- ▶️ 爬虫运行控制
- 📝 内置代码编辑器
- 📁 文件管理系统
- ⏰ 定时任务调度
- 📊 运行日志和输出监控
- 🎨 现代化UI设计（基于Radix UI）

## 技术栈

### 后端
- Flask - Web框架
- sqlite3 - 数据库
- APScheduler - 定时任务
- Flask-CORS - 跨域支持

### 前端
- React 18
- TypeScript
- Radix UI - 组件库
- Monaco Editor - 代码编辑器
- Tailwind CSS - 样式框架
- React Query - 数据获取

## 项目结构

```
spider_ux/
├── backend/          # Flask后端
│   ├── app.py       # 主应用
│   ├── models/      # 数据模型
│   ├── routes/      # API路由
│   └── utils/       # 工具函数
├── frontend/        # React前端
│   ├── src/
│   ├── public/
│   └── package.json
└── requirements.txt # Python依赖
```

## 快速开始

### 后端启动
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 前端启动
```bash
cd frontend
npm install
npm run dev
```

## API文档

- `GET /api/spiders` - 获取爬虫列表
- `POST /api/spiders` - 创建爬虫
- `PUT /api/spiders/{id}` - 更新爬虫
- `DELETE /api/spiders/{id}` - 删除爬虫
- `POST /api/spiders/{id}/run` - 运行爬虫
- `GET /api/spiders/{id}/logs` - 获取日志
- `GET /api/spiders/{id}/files` - 获取文件列表