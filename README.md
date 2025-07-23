# 📘 文献智能解读系统

一个基于AI的学术文献智能分析系统，支持PDF上传、自动摘要、关键词提取和交互式问答。

## 🚀 一键部署

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/literature-ai-system)

点击上方按钮即可一键部署到 Zeabur 云平台。详细部署指南请查看 [DEPLOY_ZEABUR.md](./DEPLOY_ZEABUR.md)。

## 🚀 功能特性

- **PDF文档上传** - 支持拖拽上传和批量处理
- **智能摘要生成** - 自动提取研究目的、方法、发现和结论
- **关键词提取** - 智能识别核心概念和术语
- **交互式问答** - 基于文献内容的智能对话
- **结构化展示** - 美观的摘要和内容可视化
- **文献检索** - 集成 arXiv 和 Semantic Scholar 双引擎检索
- **引用分析** - 智能分析论文引用次数和影响力
- **开放获取** - 支持开放获取论文的PDF下载
- **多模型支持** - 支持OpenAI、文心一言等多种LLM

## 🏗️ 技术架构

```
├── frontend/          # Next.js 前端应用
├── backend/           # Node.js + Express 后端API
├── database/          # PostgreSQL 数据库配置
└── docs/             # 技术文档
```

### 技术栈

- **前端**: Next.js 14, React, TypeScript, Tailwind CSS
- **后端**: Node.js, Express, TypeScript
- **数据库**: PostgreSQL, Redis
- **AI服务**: OpenAI GPT-4, 文心一言, DeepSeek
- **文献检索**: arXiv API, Semantic Scholar API
- **文档处理**: PDF.js, PyMuPDF
- **向量化**: FAISS, LangChain

## 🚦 快速开始

### 环境要求

- Node.js >= 18.0.0
- PostgreSQL >= 13 (可选，不配置将使用内存存储)
- Redis >= 6.0 (可选，不配置将跳过缓存功能)

### 一键启动（推荐）

```bash
# 使用启动脚本，自动检查环境并启动服务
./start-dev.sh
```

### 手动安装和配置

1. **安装依赖**
```bash
# 安装所有依赖
npm run install:all

# 或分别安装
npm install
npm run install:frontend
npm run install:backend
```

2. **环境配置**
```bash
# 复制环境变量模板
cp backend/.env.example backend/.env
```

3. **配置环境变量** (编辑 `backend/.env`)
```bash
# 必需配置
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 可选配置
SEMANTIC_API_KEY=your_semantic_scholar_api_key_here
DATABASE_URL=postgresql://username:password@localhost:5432/doc_read_ai
REDIS_URL=redis://localhost:6379
PORT=8000
CORS_ORIGIN=http://localhost:3000
```

4. **启动服务**
```bash
# 同时启动前后端开发服务器
npm run dev

# 或分别启动
npm run dev:frontend  # 前端: http://localhost:3000
npm run dev:backend   # 后端: http://localhost:5000
```

### 数据库配置（可选）

如果要使用PostgreSQL数据库：

```bash
# 创建数据库
createdb doc_read_ai

# 运行初始化脚本
psql -d doc_read_ai -f database/init.sql
```

## 📚 API文档

### 上传PDF
```http
POST /api/upload-pdf
Content-Type: multipart/form-data

FormData: { file: PDF文件 }
Response: { file_id: string, page_count: number }
```

### 生成摘要
```http
GET /api/summarize/:file_id
Response: {
  title: string,
  abstract: string,
  structure_summary: object
}
```

### 智能问答
```http
POST /api/ask
Content-Type: application/json

Body: { file_id: string, question: string }
Response: {
  answer: string,
  related_paragraphs: string[]
}
```

### arXiv 文献检索
```http
GET /api/arxiv/search?keywords=keyword1,keyword2&days=21
Response: {
  success: boolean,
  data: [
    {
      id: string,
      title: string,
      summary: string,
      authors: string[],
      published: string,
      link: string,
      semantic_score: number
    }
  ]
}
```

### Semantic Scholar 文献检索
```http
GET /api/semantic/search?query=search_term&year=2023&limit=20
Response: {
  success: boolean,
  data: {
    papers: [
      {
        id: string,
        title: string,
        abstract: string,
        authors: Array<{id: string, name: string}>,
        year: number,
        venue: string,
        url: string,
        citationCount: number,
        influentialCitationCount: number,
        isOpenAccess: boolean,
        openAccessPdf: string,
        publicationDate: string,
        publicationTypes: string[],
        publicationVenue: string,
        referenceCount: number,
        fieldsOfStudy: string[]
      }
    ],
    total: number,
    offset: number,
    limit: number
  }
}
```

### 论文详情获取
```http
GET /api/semantic/paper/:paperId
Response: {
  success: boolean,
  data: {
    // 论文详细信息，包含引用和参考文献
  }
}
```

### 作者信息获取
```http
GET /api/semantic/author/:authorId
Response: {
  success: boolean,
  data: {
    // 作者详细信息，包含论文列表
  }
}
```

## 🗄️ 数据库设计

```sql
-- 文档表
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT,
  abstract TEXT,
  raw_text TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 文档分块表
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  content TEXT,
  embedding VECTOR(1536),
  page_number INTEGER,
  chunk_index INTEGER
);
```

## 🎯 开发路线图

- [x] 基础项目架构
- [x] PDF上传和解析
- [x] LLM集成和摘要生成
- [x] 智能问答系统
- [x] 关键词提取功能
- [x] 文档管理界面
- [x] 系统测试功能
- [ ] 文本向量化处理
- [ ] 图表识别功能
- [ ] 批量处理优化
- [ ] 用户管理系统

## 📋 当前功能状态

✅ **已完成功能**
- PDF文档上传和解析
- 智能摘要生成
- 关键词自动提取
- 基于文档的智能问答
- 文档列表管理
- 响应式Web界面
- 系统健康检查
- arXiv 文献检索（支持语义重排序）
- Semantic Scholar 文献检索（支持引用分析）
- 论文详情和作者信息获取
- 开放获取论文PDF下载

🚧 **开发中功能**
- 数据库持久化存储
- 向量化搜索
- 批量文档处理

## 🔧 系统要求

**最低要求**
- Node.js 18+
- 2GB RAM
- OpenAI API密钥

**推荐配置**
- Node.js 20+
- 4GB RAM
- PostgreSQL 13+
- Redis 6+

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

---

Built with ❤️ by AI Superman 