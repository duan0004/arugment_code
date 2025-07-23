# 🚀 文献智能解读系统 - Zeabur 部署总结

## 📋 部署准备完成

您的文献智能解读系统已经完全准备好部署到 Zeabur 云平台！

### ✅ 已完成的配置

1. **项目结构优化**
   - ✅ 前后端分离架构
   - ✅ 生产环境配置文件
   - ✅ 环境变量管理
   - ✅ 构建脚本优化

2. **Zeabur 配置文件**
   - ✅ `zeabur.json` - 项目配置
   - ✅ `template.yaml` - 模板配置
   - ✅ 环境变量配置
   - ✅ 服务依赖关系

3. **部署脚本和工具**
   - ✅ `deploy-zeabur.sh` - 自动部署脚本
   - ✅ `check-deployment.js` - 部署检查工具
   - ✅ GitHub Actions 工作流
   - ✅ 详细部署文档

## 🎯 部署方式

### 方式一：一键部署（推荐）

```bash
# 点击部署按钮
https://zeabur.com/templates/literature-ai-system
```

### 方式二：自动脚本部署

```bash
# 运行部署脚本
./deploy-zeabur.sh
```

### 方式三：手动部署

```bash
# 1. 安装 Zeabur CLI
npm install -g @zeabur/cli

# 2. 登录
zeabur auth login

# 3. 创建项目
zeabur project create literature-ai-system

# 4. 部署服务
zeabur service create postgresql database
zeabur service create nodejs backend
zeabur service create nextjs frontend
```

## ⚙️ 必需的环境变量

### 后端服务

| 变量名 | 描述 | 必需 |
|--------|------|------|
| `NODE_ENV` | 运行环境 | ✅ |
| `PORT` | 服务端口 | ✅ |
| `DATABASE_URL` | 数据库连接 | ✅ |
| `JWT_SECRET` | JWT 签名密钥 | ✅ |
| `OPENAI_API_KEY` | OpenAI API 密钥 | ⚠️ |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | ⚠️ |

### 前端服务

| 变量名 | 描述 | 必需 |
|--------|------|------|
| `NODE_ENV` | 运行环境 | ✅ |
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 | ✅ |

## 🔧 部署后配置

### 1. 设置 API 密钥

在 Zeabur 控制台中设置：

```bash
# OpenAI API 密钥（用于向量化和 AI 功能）
OPENAI_API_KEY=sk-...

# DeepSeek API 密钥（用于智能问答功能）
DEEPSEEK_API_KEY=sk-...
```

### 2. 验证部署

```bash
# 使用检查脚本
node check-deployment.js https://your-frontend.zeabur.app https://your-backend.zeabur.app
```

### 3. 测试功能

- 📚 上传 PDF 文档
- 🤖 测试 AI 问答
- 🔍 尝试语义搜索
- 👥 用户注册登录

## 📊 系统特性

### 🚀 核心功能

- **📄 PDF文档上传**: 支持拖拽上传和批量处理
- **🤖 AI智能问答**: 基于文档内容的智能对话
- **🔍 语义搜索**: 向量化搜索和相似度匹配
- **👥 用户管理**: 完整的认证授权系统
- **📊 批量处理**: 高效的文件处理队列
- **🛡️ 优雅降级**: 数据库/Redis不可用时的内存备选

### 🔧 技术栈

- **前端**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **后端**: Node.js, Express, TypeScript, Prisma
- **数据库**: PostgreSQL
- **队列**: Redis (可选)
- **AI服务**: OpenAI GPT, DeepSeek

### 🛡️ 安全特性

- JWT 令牌认证
- 密码加密存储
- CORS 跨域保护
- 输入验证和清理
- 权限控制系统

## 📈 性能优化

- 异步文件处理
- 队列批量处理
- 向量化缓存
- 响应压缩
- 静态资源优化

## 🐛 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 `DATABASE_URL` 环境变量
   - 确认 PostgreSQL 服务正常

2. **API 密钥错误**
   - 检查 `OPENAI_API_KEY` 和 `DEEPSEEK_API_KEY`
   - 确认 API 密钥有效且有配额

3. **前端无法连接后端**
   - 检查 `NEXT_PUBLIC_API_URL` 设置
   - 确认后端服务正常运行

### 查看日志

```bash
# Zeabur CLI 查看日志
zeabur service logs backend
zeabur service logs frontend
```

## 💰 费用预估

Zeabur 提供免费额度，超出后按使用量计费：

- **免费额度**: 每月一定的计算时间和流量
- **付费计划**: 按实际使用的 CPU、内存、网络流量计费

## 📞 支持资源

- [Zeabur 文档](https://zeabur.com/docs)
- [项目 GitHub](https://github.com/your-username/literature-ai-system)
- [部署指南](./DEPLOY_ZEABUR.md)
- [使用文档](./README.md)

## 🎉 部署完成

恭喜！您的文献智能解读系统已准备好部署到 Zeabur。

### 下一步：

1. 点击一键部署按钮或运行部署脚本
2. 在 Zeabur 控制台设置 API 密钥
3. 验证部署状态
4. 开始使用您的智能文献解读系统！

---

**祝您部署顺利！** 🚀

如有问题，请查看详细的 [部署指南](./DEPLOY_ZEABUR.md) 或提交 GitHub Issue。
