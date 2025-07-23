import prisma from '../config/database';
import { Document, DocumentChunk, QAHistory } from '@prisma/client';

// 内存存储备选方案
interface MemoryDocument {
  id: string;
  file_id: string;
  original_name: string;
  file_size: bigint;
  page_count: number;
  text_content?: string;
  file_path: string;
  user_id?: string;
  summary?: any;
  keywords: string[];
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface MemoryQAHistory {
  id: string;
  document_id: string;
  question: string;
  answer: string;
  created_at: Date;
}

// 内存存储
const memoryDocuments = new Map<string, MemoryDocument>();
const memoryQAHistory = new Map<string, MemoryQAHistory[]>();
let documentIdCounter = 1;

export interface DocumentData {
  file_id: string;
  original_name: string;
  file_size: number;
  page_count: number;
  text_content?: string;
  file_path: string;
  user_id?: string;
  metadata?: any;
}

export interface DocumentWithRelations extends Document {
  chunks?: DocumentChunk[];
  qa_history?: QAHistory[];
}

export class DocumentService {
  // 创建文档
  static async createDocument(data: DocumentData): Promise<Document> {
    if (prisma) {
      try {
        return await prisma.document.create({
          data: {
            file_id: data.file_id,
            original_name: data.original_name,
            file_size: BigInt(data.file_size),
            page_count: data.page_count,
            text_content: data.text_content,
            file_path: data.file_path,
            user_id: data.user_id,
            metadata: data.metadata || {},
          },
        });
      } catch (error) {
        console.error('数据库创建文档失败，降级到内存存储:', error);
        // 数据库失败时降级到内存存储
        const id = `doc_${documentIdCounter++}`;
        const now = new Date();
        const memoryDoc: MemoryDocument = {
          id,
          file_id: data.file_id,
          original_name: data.original_name,
          file_size: BigInt(data.file_size),
          page_count: data.page_count,
          text_content: data.text_content,
          file_path: data.file_path,
          user_id: data.user_id,
          summary: null,
          keywords: [],
          metadata: data.metadata || {},
          created_at: now,
          updated_at: now,
        };
        memoryDocuments.set(data.file_id, memoryDoc);
        return memoryDoc as any;
      }
    } else {
      // 使用内存存储
      const id = `doc_${documentIdCounter++}`;
      const now = new Date();
      const memoryDoc: MemoryDocument = {
        id,
        file_id: data.file_id,
        original_name: data.original_name,
        file_size: BigInt(data.file_size),
        page_count: data.page_count,
        text_content: data.text_content,
        file_path: data.file_path,
        user_id: data.user_id,
        summary: null,
        keywords: [],
        metadata: data.metadata || {},
        created_at: now,
        updated_at: now,
      };
      memoryDocuments.set(data.file_id, memoryDoc);
      return memoryDoc as any;
    }
  }

  // 根据file_id获取文档
  static async getDocumentByFileId(file_id: string): Promise<DocumentWithRelations | null> {
    if (prisma) {
      try {
        return await prisma.document.findUnique({
          where: { file_id },
          include: {
            chunks: true,
            qa_history: {
              orderBy: { created_at: 'desc' },
              take: 10, // 只获取最近10条问答记录
            },
          },
        });
      } catch (error) {
        console.error('数据库查询文档失败，降级到内存存储:', error);
        // 数据库失败时降级到内存存储
        const memoryDoc = memoryDocuments.get(file_id);
        if (!memoryDoc) return null;

        const qaHistory = memoryQAHistory.get(memoryDoc.id) || [];
        return {
          ...memoryDoc,
          chunks: [],
          qa_history: qaHistory.slice(0, 10),
        } as any;
      }
    } else {
      // 使用内存存储
      const memoryDoc = memoryDocuments.get(file_id);
      if (!memoryDoc) return null;

      const qaHistory = memoryQAHistory.get(memoryDoc.id) || [];
      return {
        ...memoryDoc,
        chunks: [],
        qa_history: qaHistory.slice(0, 10),
      } as any;
    }
  }

  // 获取文档列表
  static async getDocuments(user_id?: string, page = 1, limit = 20): Promise<{
    documents: Document[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (prisma) {
      try {
        const skip = (page - 1) * limit;
        const where = user_id ? { user_id } : {};

        const [documents, total] = await Promise.all([
          prisma!.document.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip,
            take: limit,
            select: {
              id: true,
              file_id: true,
              user_id: true,
              original_name: true,
              file_size: true,
              page_count: true,
              text_content: true,
              file_path: true,
              summary: true,
              keywords: true,
              metadata: true,
              created_at: true,
              updated_at: true,
            },
          }),
          prisma!.document.count({ where }),
        ]);

        return {
          documents: documents as any,
          total,
          page,
          limit,
        };
      } catch (error) {
        console.error('数据库查询失败，降级到内存存储:', error);
        // 数据库失败时降级到内存存储
        const allDocs = Array.from(memoryDocuments.values());
        const filteredDocs = user_id ? allDocs.filter(doc => doc.user_id === user_id) : allDocs;
        const sortedDocs = filteredDocs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

        const skip = (page - 1) * limit;
        const paginatedDocs = sortedDocs.slice(skip, skip + limit);

        return {
          documents: paginatedDocs as any,
          total: filteredDocs.length,
          page,
          limit,
        };
      }
    } else {
      // 使用内存存储
      const allDocs = Array.from(memoryDocuments.values());
      const filteredDocs = user_id ? allDocs.filter(doc => doc.user_id === user_id) : allDocs;
      const sortedDocs = filteredDocs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      const skip = (page - 1) * limit;
      const paginatedDocs = sortedDocs.slice(skip, skip + limit);

      return {
        documents: paginatedDocs as any,
        total: filteredDocs.length,
        page,
        limit,
      };
    }
  }

  // 更新文档摘要
  static async updateDocumentSummary(file_id: string, summary: any): Promise<Document | null> {
    if (prisma) {
      try {
        return await prisma!.document.update({
          where: { file_id },
          data: { summary },
        });
      } catch (error) {
        console.error('更新文档摘要失败:', error);
        return null;
      }
    } else {
      // 使用内存存储
      const memoryDoc = memoryDocuments.get(file_id);
      if (!memoryDoc) return null;

      memoryDoc.summary = summary;
      memoryDoc.updated_at = new Date();
      return memoryDoc as any;
    }
  }

  // 更新文档关键词
  static async updateDocumentKeywords(file_id: string, keywords: string[]): Promise<Document | null> {
    if (prisma) {
      try {
        return await prisma!.document.update({
          where: { file_id },
          data: { keywords },
        });
      } catch (error) {
        console.error('更新文档关键词失败:', error);
        return null;
      }
    } else {
      // 使用内存存储
      const memoryDoc = memoryDocuments.get(file_id);
      if (!memoryDoc) return null;

      memoryDoc.keywords = keywords;
      memoryDoc.updated_at = new Date();
      return memoryDoc as any;
    }
  }

  // 删除文档
  static async deleteDocument(file_id: string): Promise<boolean> {
    if (prisma) {
      try {
        await prisma!.document.delete({
          where: { file_id },
        });
        return true;
      } catch (error) {
        console.error('数据库删除文档失败，降级到内存存储:', error);
        // 数据库失败时降级到内存存储
        const memoryDoc = memoryDocuments.get(file_id);
        if (!memoryDoc) return false;

        memoryDocuments.delete(file_id);
        memoryQAHistory.delete(memoryDoc.id);
        return true;
      }
    } else {
      // 使用内存存储
      const memoryDoc = memoryDocuments.get(file_id);
      if (!memoryDoc) return false;

      memoryDocuments.delete(file_id);
      memoryQAHistory.delete(memoryDoc.id);
      return true;
    }
  }

  // 添加问答记录
  static async addQAHistory(document_id: string, question: string, answer: string): Promise<QAHistory | null> {
    if (prisma) {
      try {
        return await prisma!.qAHistory.create({
          data: {
            document_id,
            question,
            answer,
          },
        });
      } catch (error) {
        console.error('添加问答记录失败:', error);
        return null;
      }
    } else {
      // 使用内存存储
      const qaRecord: MemoryQAHistory = {
        id: `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        document_id,
        question,
        answer,
        created_at: new Date(),
      };

      if (!memoryQAHistory.has(document_id)) {
        memoryQAHistory.set(document_id, []);
      }
      memoryQAHistory.get(document_id)!.unshift(qaRecord);

      return qaRecord as any;
    }
  }

  // 获取问答历史
  static async getQAHistory(document_id: string, limit = 20): Promise<QAHistory[]> {
    if (prisma) {
      try {
        return await prisma!.qAHistory.findMany({
          where: { document_id },
          orderBy: { created_at: 'desc' },
          take: limit,
        });
      } catch (error) {
        console.error('获取问答历史失败:', error);
        return [];
      }
    } else {
      // 使用内存存储
      const qaHistory = memoryQAHistory.get(document_id) || [];
      return qaHistory.slice(0, limit) as any;
    }
  }

  // 检查文档是否存在
  static async documentExists(file_id: string): Promise<boolean> {
    if (prisma) {
      try {
        const count = await prisma!.document.count({
          where: { file_id },
        });
        return count > 0;
      } catch (error) {
        console.error('检查文档存在性失败:', error);
        return false;
      }
    } else {
      // 使用内存存储
      return memoryDocuments.has(file_id);
    }
  }

  // 获取文档统计信息
  static async getDocumentStats(user_id?: string): Promise<{
    total: number;
    withSummary: number;
    withKeywords: number;
    totalSize: number;
  }> {
    if (prisma) {
      try {
        const where = user_id ? { user_id } : {};

        // 获取所有文档
        const documents = await prisma!.document.findMany({
          where,
          select: {
            summary: true,
            keywords: true,
            file_size: true,
          },
        });

        const total = documents.length;
        const withSummary = documents.filter(doc => doc.summary !== null).length;
        const withKeywords = documents.filter(doc => doc.keywords.length > 0).length;
        const totalSize = documents.reduce((sum, doc) => sum + Number(doc.file_size), 0);

        return {
          total,
          withSummary,
          withKeywords,
          totalSize,
        };
      } catch (error) {
        console.error('数据库统计查询失败，降级到内存存储:', error);
        // 数据库失败时降级到内存存储
        const allDocs = Array.from(memoryDocuments.values());
        const filteredDocs = user_id ? allDocs.filter(doc => doc.user_id === user_id) : allDocs;

        const withSummary = filteredDocs.filter(doc => doc.summary).length;
        const withKeywords = filteredDocs.filter(doc => doc.keywords.length > 0).length;
        const totalSize = filteredDocs.reduce((sum, doc) => sum + Number(doc.file_size), 0);

        return {
          total: filteredDocs.length,
          withSummary,
          withKeywords,
          totalSize,
        };
      }
    } else {
      // 使用内存存储
      const allDocs = Array.from(memoryDocuments.values());
      const filteredDocs = user_id ? allDocs.filter(doc => doc.user_id === user_id) : allDocs;

      const withSummary = filteredDocs.filter(doc => doc.summary).length;
      const withKeywords = filteredDocs.filter(doc => doc.keywords.length > 0).length;
      const totalSize = filteredDocs.reduce((sum, doc) => sum + Number(doc.file_size), 0);

      return {
        total: filteredDocs.length,
        withSummary,
        withKeywords,
        totalSize,
      };
    }
  }
}
