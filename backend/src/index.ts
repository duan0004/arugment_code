
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';

import uploadRoutes from './routes/upload';
import documentRoutes from './routes/document';
import aiRoutes from './routes/ai';
import arxivRoutes from './routes/arxiv';
import semanticRoutes from './routes/semantic';
import vectorRoutes from './routes/vector';
import authRoutes from './routes/auth';
import batchRoutes from './routes/batch';

import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 8000;

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/arxiv', arxivRoutes);
app.use('/api/semantic', semanticRoutes);
app.use('/api/vector', vectorRoutes);
app.use('/api/batch', batchRoutes);

// 错误处理中间件
app.use(notFound);
app.use(errorHandler);

// 启动服务器
async function startServer() {
  try {
    console.log('🚀 启动文献智能解读模块后端服务...');
    
    app.listen(PORT, () => {
      console.log(`✅ 服务器启动成功，端口: ${PORT}`);
      console.log(`📖 API文档: http://localhost:${PORT}/health`);
      console.log(`💡 当前使用内存存储，重启后数据会丢失`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始优雅关闭...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，开始优雅关闭...');
  process.exit(0);
});

startServer(); 