# 文献智能解读系统 - Zeabur 部署指南

本指南将帮助您将文献智能解读系统部署到 [Zeabur](https://zeabur.com/) 云平台。

## 🚀 快速部署

### 方法一：一键部署（推荐）

1. **点击部署按钮**
   
   [![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/literature-ai-system)

2. **配置环境变量**（部署后在控制台设置）
   - `OPENAI_API_KEY`: OpenAI API 密钥
   - `DEEPSEEK_API_KEY`: DeepSeek API 密钥
   - `JWT_SECRET`: JWT 签名密钥（自动生成）

### 方法二：手动部署

#### 1. 准备工作

```bash
# 安装 Zeabur CLI
npm install -g @zeabur/cli

# 登录 Zeabur
zeabur auth login
```

#### 2. 执行部署脚本

```bash
# 运行自动部署脚本
./deploy-zeabur.sh
```

#### 3. 手动部署步骤

如果自动脚本失败，可以手动执行以下步骤：

```bash
# 1. 创建项目
zeabur project create literature-ai-system
zeabur project use literature-ai-system

# 2. 部署数据库
zeabur service create postgresql database

# 3. 部署后端
cd backend
zeabur service create nodejs backend
zeabur service deploy backend

# 4. 部署前端
cd ../frontend
zeabur service create nextjs frontend
zeabur service deploy frontend
```

## ⚙️ 环境变量配置

### 后端环境变量

在 Zeabur 控制台的后端服务中设置以下环境变量：

| 变量名 | 描述 | 必需 | 示例值 |
|--------|------|------|--------|
| `NODE_ENV` | 运行环境 | ✅ | `production` |
| `PORT` | 服务端口 | ✅ | `8000` |
| `DATABASE_URL` | 数据库连接 | ✅ | 自动注入 |
| `JWT_SECRET` | JWT 签名密钥 | ✅ | 随机生成的32位字符串 |
| `OPENAI_API_KEY` | OpenAI API 密钥 | ⚠️ | `sk-...` |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | ⚠️ | `sk-...` |
| `REDIS_URL` | Redis 连接 | ❌ | 自动注入（可选） |
| `CORS_ORIGIN` | CORS 允许源 | ❌ | 前端域名 |

### 前端环境变量

在 Zeabur 控制台的前端服务中设置以下环境变量：

| 变量名 | 描述 | 必需 | 示例值 |
|--------|------|------|--------|
| `NODE_ENV` | 运行环境 | ✅ | `production` |
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 | ✅ | 自动注入 |
| `NEXT_PUBLIC_APP_NAME` | 应用名称 | ❌ | `文献智能解读系统` |

## 🗄️ 数据库配置

### PostgreSQL 设置

Zeabur 会自动创建 PostgreSQL 数据库并注入连接信息。数据库迁移会在后端服务启动时自动执行。

### Redis 设置（可选）

如果需要 Redis 支持（用于队列处理），可以添加 Redis 服务：

```bash
zeabur service create redis redis
```

## 🔧 部署后配置

### 1. 验证部署状态

访问以下链接验证服务是否正常：

- 前端：`https://your-project-frontend.zeabur.app`
- 后端健康检查：`https://your-project-backend.zeabur.app/health`

### 2. 设置自定义域名（可选）

在 Zeabur 控制台中可以为服务设置自定义域名：

1. 进入项目控制台
2. 选择服务
3. 点击 "Domains" 标签
4. 添加自定义域名

### 3. 配置 API 密钥

⚠️ **重要**：部署完成后，请在 Zeabur 控制台中设置 API 密钥：

1. 进入后端服务设置
2. 添加环境变量：
   - `OPENAI_API_KEY`: 用于向量化和 AI 功能
   - `DEEPSEEK_API_KEY`: 用于智能问答功能

## 📊 监控和日志

### 查看服务状态

```bash
# 查看服务列表
zeabur service list

# 查看服务日志
zeabur service logs backend
zeabur service logs frontend
```

### 性能监控

Zeabur 提供内置的性能监控，可以在控制台中查看：

- CPU 使用率
- 内存使用率
- 网络流量
- 响应时间

## 🔄 更新部署

### 自动部署

推送代码到 GitHub 仓库后，Zeabur 会自动触发重新部署。

### 手动部署

```bash
# 重新部署后端
cd backend
zeabur service deploy backend

# 重新部署前端
cd ../frontend
zeabur service deploy frontend
```

## 🐛 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 `DATABASE_URL` 环境变量是否正确注入
   - 确认 Prisma 迁移是否成功执行

2. **API 密钥错误**
   - 检查 `OPENAI_API_KEY` 和 `DEEPSEEK_API_KEY` 是否正确设置
   - 确认 API 密钥有足够的配额

3. **前端无法连接后端**
   - 检查 `NEXT_PUBLIC_API_URL` 是否正确设置
   - 确认后端服务是否正常运行

4. **文件上传失败**
   - Zeabur 的文件系统是临时的，大文件建议使用对象存储

### 查看日志

```bash
# 查看详细日志
zeabur service logs backend --follow
zeabur service logs frontend --follow
```

## 💰 费用说明

Zeabur 提供免费额度，超出后按使用量计费：

- **免费额度**：每月一定的计算时间和流量
- **付费计划**：按实际使用的 CPU、内存、网络流量计费

详细价格请查看：https://zeabur.com/pricing

## 📞 支持

如果遇到部署问题，可以：

1. 查看 [Zeabur 文档](https://zeabur.com/docs)
2. 联系 [Zeabur 支持](https://zeabur.com/support)
3. 提交 GitHub Issue

## 🎉 部署完成

恭喜！您的文献智能解读系统已成功部署到 Zeabur。

现在您可以：

- 📚 上传 PDF 文档进行解析
- 🤖 使用 AI 问答功能
- 🔍 进行语义搜索
- 👥 管理用户和权限
- 📊 查看系统统计

享受您的智能文献解读系统吧！🚀
