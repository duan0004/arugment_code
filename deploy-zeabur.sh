#!/bin/bash

# Zeabur 部署脚本
# 文献智能解读系统

echo "🚀 开始部署文献智能解读系统到 Zeabur..."

# 检查是否安装了 Zeabur CLI
if ! command -v zeabur &> /dev/null; then
    echo "❌ Zeabur CLI 未安装，请先安装："
    echo "npm install -g @zeabur/cli"
    exit 1
fi

# 检查是否已登录
if ! zeabur auth whoami &> /dev/null; then
    echo "🔐 请先登录 Zeabur："
    zeabur auth login
fi

# 创建项目（如果不存在）
echo "📦 创建 Zeabur 项目..."
PROJECT_NAME="literature-ai-system"

# 检查项目是否存在
if ! zeabur project list | grep -q "$PROJECT_NAME"; then
    zeabur project create "$PROJECT_NAME"
    echo "✅ 项目 $PROJECT_NAME 创建成功"
else
    echo "ℹ️  项目 $PROJECT_NAME 已存在"
fi

# 切换到项目
zeabur project use "$PROJECT_NAME"

# 部署数据库服务
echo "🗄️  部署 PostgreSQL 数据库..."
zeabur service create postgresql database

# 部署后端服务
echo "🔧 部署后端服务..."
cd backend
zeabur service create nodejs backend
zeabur service deploy backend

# 设置后端环境变量
echo "⚙️  设置后端环境变量..."
zeabur env set JWT_SECRET "$(openssl rand -base64 32)"
zeabur env set NODE_ENV production
zeabur env set PORT 8000

# 返回根目录
cd ..

# 部署前端服务
echo "🎨 部署前端服务..."
cd frontend
zeabur service create nextjs frontend
zeabur service deploy frontend

# 设置前端环境变量
echo "⚙️  设置前端环境变量..."
zeabur env set NODE_ENV production
zeabur env set NEXT_PUBLIC_APP_NAME "文献智能解读系统"

# 返回根目录
cd ..

echo "🎉 部署完成！"
echo ""
echo "📋 部署信息："
echo "- 项目名称: $PROJECT_NAME"
echo "- 后端服务: backend"
echo "- 前端服务: frontend"
echo "- 数据库: PostgreSQL"
echo ""
echo "🔗 访问链接："
echo "- 前端: https://$PROJECT_NAME-frontend.zeabur.app"
echo "- 后端: https://$PROJECT_NAME-backend.zeabur.app"
echo ""
echo "⚠️  请在 Zeabur 控制台中设置以下环境变量："
echo "- OPENAI_API_KEY: OpenAI API 密钥"
echo "- DEEPSEEK_API_KEY: DeepSeek API 密钥"
echo ""
echo "📖 更多信息请查看 Zeabur 控制台: https://dash.zeabur.com"
