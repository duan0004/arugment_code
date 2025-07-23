import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

try {
  // 检查是否配置了数据库URL
  if (process.env.DATABASE_URL) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
    console.log('✅ 数据库连接已初始化');
  } else {
    console.warn('⚠️  DATABASE_URL 未配置，将使用内存存储');
  }
} catch (error) {
  console.error('❌ 数据库连接失败:', error);
  console.warn('⚠️  将使用内存存储作为备选方案');
}

export default prisma;