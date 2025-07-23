import { OpenAI } from 'openai';
import prisma from '../config/database';

// 向量化配置
const CHUNK_SIZE = 1000; // 每个分块的字符数
const CHUNK_OVERLAP = 200; // 分块重叠字符数
const EMBEDDING_DIMENSION = 1536; // OpenAI embedding维度

// OpenAI客户端
let openaiClient: OpenAI | null = null;

// 初始化OpenAI客户端
function initOpenAI() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI向量化服务已初始化');
  } else if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY 未配置，向量化功能将不可用');
  }
}

// 初始化
initOpenAI();

// 内存向量存储（备选方案）
interface MemoryVector {
  id: string;
  document_id: string;
  content: string;
  embedding: number[];
  page_number?: number;
  chunk_index: number;
  token_count?: number;
  created_at: Date;
}

const memoryVectors = new Map<string, MemoryVector>();

export class VectorService {
  // 文本分块
  static splitText(text: string): string[] {
    if (!text || text.length === 0) return [];
    
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + CHUNK_SIZE;
      
      // 如果不是最后一块，尝试在句号、换行符或空格处分割
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const lastSpace = text.lastIndexOf(' ', end);
        
        const breakPoint = Math.max(lastPeriod, lastNewline, lastSpace);
        if (breakPoint > start + CHUNK_SIZE * 0.5) {
          end = breakPoint + 1;
        }
      }
      
      chunks.push(text.slice(start, end).trim());
      start = end - CHUNK_OVERLAP;
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  }

  // 生成文本向量
  static async generateEmbedding(text: string): Promise<number[] | null> {
    if (!openaiClient) {
      console.warn('OpenAI客户端未初始化，使用模拟向量');
      return this.generateMockEmbedding(text);
    }

    try {
      const response = await openaiClient.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data[0]?.embedding || null;
    } catch (error) {
      console.error('生成向量失败，使用模拟向量:', error);
      return this.generateMockEmbedding(text);
    }
  }

  // 生成模拟向量（用于演示）
  private static generateMockEmbedding(text: string): number[] {
    // 基于文本内容生成确定性的模拟向量
    const embedding = new Array(EMBEDDING_DIMENSION).fill(0);

    // 使用文本的字符码和位置生成向量
    for (let i = 0; i < text.length && i < EMBEDDING_DIMENSION; i++) {
      const charCode = text.charCodeAt(i);
      embedding[i] = Math.sin(charCode * (i + 1)) * 0.1;
    }

    // 添加一些基于文本特征的向量分量
    const textFeatures = {
      length: text.length,
      wordCount: text.split(/\s+/).length,
      hasNumbers: /\d/.test(text),
      hasUpperCase: /[A-Z]/.test(text),
      hasPunctuation: /[.,!?;:]/.test(text),
    };

    // 将文本特征编码到向量中
    embedding[0] = Math.tanh(textFeatures.length / 1000);
    embedding[1] = Math.tanh(textFeatures.wordCount / 100);
    embedding[2] = textFeatures.hasNumbers ? 0.5 : -0.5;
    embedding[3] = textFeatures.hasUpperCase ? 0.5 : -0.5;
    embedding[4] = textFeatures.hasPunctuation ? 0.5 : -0.5;

    // 归一化向量
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => norm > 0 ? val / norm : 0);
  }

  // 处理文档向量化
  static async processDocumentVectorization(documentId: string, text: string): Promise<boolean> {
    try {
      // 分块
      const chunks = this.splitText(text);
      console.log(`文档 ${documentId} 分为 ${chunks.length} 个分块`);

      // 为每个分块生成向量
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk) continue;

        const embedding = await this.generateEmbedding(chunk);

        if (embedding) {
          await this.saveChunkVector(documentId, chunk, embedding, i);
        } else {
          console.warn(`分块 ${i} 向量生成失败，跳过`);
        }
      }

      return true;
    } catch (error) {
      console.error('文档向量化处理失败:', error);
      return false;
    }
  }

  // 保存分块向量
  static async saveChunkVector(
    documentId: string, 
    content: string, 
    embedding: number[], 
    chunkIndex: number,
    pageNumber?: number
  ): Promise<boolean> {
    if (prisma) {
      try {
        await prisma!.documentChunk.create({
          data: {
            document_id: documentId,
            content,
            // embedding, // 暂时注释，等pgvector扩展配置后启用
            page_number: pageNumber || null,
            chunk_index: chunkIndex,
            token_count: Math.ceil(content.length / 4), // 粗略估算token数
          },
        });
        return true;
      } catch (error) {
        console.error('数据库保存分块向量失败，降级到内存存储:', error);
        // 降级到内存存储
        const vectorId = `${documentId}_chunk_${chunkIndex}`;
        const memoryVector: MemoryVector = {
          id: vectorId,
          document_id: documentId,
          content,
          embedding,
          page_number: pageNumber || undefined,
          chunk_index: chunkIndex,
          token_count: Math.ceil(content.length / 4),
          created_at: new Date(),
        };
        memoryVectors.set(vectorId, memoryVector);
        return true;
      }
    } else {
      // 使用内存存储
      const vectorId = `${documentId}_chunk_${chunkIndex}`;
      const memoryVector: MemoryVector = {
        id: vectorId,
        document_id: documentId,
        content,
        embedding,
        page_number: pageNumber || undefined,
        chunk_index: chunkIndex,
        token_count: Math.ceil(content.length / 4),
        created_at: new Date(),
      };
      memoryVectors.set(vectorId, memoryVector);
      return true;
    }
  }

  // 计算余弦相似度
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] || 0;
      const bVal = b[i] || 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // 语义搜索
  static async semanticSearch(
    query: string, 
    documentId?: string, 
    limit = 5
  ): Promise<Array<{
    content: string;
    similarity: number;
    document_id: string;
    chunk_index: number;
    page_number?: number;
  }>> {
    try {
      // 生成查询向量
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        console.warn('查询向量生成失败');
        return [];
      }

      const results: Array<{
        content: string;
        similarity: number;
        document_id: string;
        chunk_index: number;
        page_number?: number;
      }> = [];

      if (prisma) {
        try {
          // 从数据库获取向量（暂时不包含embedding字段）
          const chunks = await prisma!.documentChunk.findMany({
            where: documentId ? { document_id: documentId } : {},
            orderBy: { chunk_index: 'asc' },
          });

          // 由于暂时没有pgvector，我们使用内存向量进行相似度计算
          for (const chunk of chunks) {
            const vectorKey = `${chunk.document_id}_chunk_${chunk.chunk_index}`;
            const memoryVector = memoryVectors.get(vectorKey);

            if (memoryVector && memoryVector.embedding) {
              const similarity = this.cosineSimilarity(queryEmbedding, memoryVector.embedding);
              results.push({
                content: chunk.content,
                similarity,
                document_id: chunk.document_id,
                chunk_index: chunk.chunk_index,
                page_number: chunk.page_number || undefined,
              });
            }
          }
        } catch (error) {
          console.error('数据库语义搜索失败，降级到内存搜索:', error);
          // 降级到内存搜索
          return this.memorySemanticSearch(queryEmbedding, documentId, limit);
        }
      } else {
        // 使用内存搜索
        return this.memorySemanticSearch(queryEmbedding, documentId, limit);
      }

      // 按相似度排序并返回前N个结果
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      console.error('语义搜索失败:', error);
      return [];
    }
  }

  // 内存语义搜索
  private static memorySemanticSearch(
    queryEmbedding: number[], 
    documentId?: string, 
    limit = 5
  ): Array<{
    content: string;
    similarity: number;
    document_id: string;
    chunk_index: number;
    page_number?: number;
  }> {
    const results: Array<{
      content: string;
      similarity: number;
      document_id: string;
      chunk_index: number;
      page_number?: number;
    }> = [];

    for (const vector of memoryVectors.values()) {
      if (documentId && vector.document_id !== documentId) continue;
      
      const similarity = this.cosineSimilarity(queryEmbedding, vector.embedding);
      results.push({
        content: vector.content,
        similarity,
        document_id: vector.document_id,
        chunk_index: vector.chunk_index,
        page_number: vector.page_number,
      });
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // 获取文档的所有分块
  static async getDocumentChunks(documentId: string): Promise<Array<{
    content: string;
    chunk_index: number;
    page_number?: number;
    token_count?: number;
  }>> {
    if (prisma) {
      try {
        const chunks = await prisma!.documentChunk.findMany({
          where: { document_id: documentId },
          orderBy: { chunk_index: 'asc' },
          select: {
            content: true,
            chunk_index: true,
            page_number: true,
            token_count: true,
          },
        });
        return chunks.map(chunk => ({
          content: chunk.content,
          chunk_index: chunk.chunk_index,
          page_number: chunk.page_number || undefined,
          token_count: chunk.token_count || undefined,
        }));
      } catch (error) {
        console.error('数据库获取分块失败，降级到内存存储:', error);
        // 降级到内存存储
        const chunks = Array.from(memoryVectors.values())
          .filter(v => v.document_id === documentId)
          .sort((a, b) => a.chunk_index - b.chunk_index);
        
        return chunks.map(chunk => ({
          content: chunk.content,
          chunk_index: chunk.chunk_index,
          page_number: chunk.page_number,
          token_count: chunk.token_count,
        }));
      }
    } else {
      // 使用内存存储
      const chunks = Array.from(memoryVectors.values())
        .filter(v => v.document_id === documentId)
        .sort((a, b) => a.chunk_index - b.chunk_index);
      
      return chunks.map(chunk => ({
        content: chunk.content,
        chunk_index: chunk.chunk_index,
        page_number: chunk.page_number,
        token_count: chunk.token_count,
      }));
    }
  }

  // 删除文档的所有向量
  static async deleteDocumentVectors(documentId: string): Promise<boolean> {
    if (prisma) {
      try {
        await prisma!.documentChunk.deleteMany({
          where: { document_id: documentId },
        });
        
        // 同时清理内存中的向量
        for (const [key, vector] of memoryVectors.entries()) {
          if (vector.document_id === documentId) {
            memoryVectors.delete(key);
          }
        }
        
        return true;
      } catch (error) {
        console.error('数据库删除向量失败:', error);
        // 降级到内存清理
        for (const [key, vector] of memoryVectors.entries()) {
          if (vector.document_id === documentId) {
            memoryVectors.delete(key);
          }
        }
        return true;
      }
    } else {
      // 使用内存存储
      for (const [key, vector] of memoryVectors.entries()) {
        if (vector.document_id === documentId) {
          memoryVectors.delete(key);
        }
      }
      return true;
    }
  }

  // 获取向量化统计信息
  static async getVectorStats(): Promise<{
    totalChunks: number;
    totalDocuments: number;
    averageChunksPerDocument: number;
  }> {
    if (prisma) {
      try {
        const [totalChunks, uniqueDocuments] = await Promise.all([
          prisma!.documentChunk.count(),
          prisma!.documentChunk.groupBy({
            by: ['document_id'],
          }),
        ]);

        return {
          totalChunks,
          totalDocuments: uniqueDocuments.length,
          averageChunksPerDocument: uniqueDocuments.length > 0 ? totalChunks / uniqueDocuments.length : 0,
        };
      } catch (error) {
        console.error('数据库统计失败，降级到内存统计:', error);
        // 降级到内存统计
        return this.getMemoryVectorStats();
      }
    } else {
      return this.getMemoryVectorStats();
    }
  }

  private static getMemoryVectorStats(): {
    totalChunks: number;
    totalDocuments: number;
    averageChunksPerDocument: number;
  } {
    const totalChunks = memoryVectors.size;
    const uniqueDocuments = new Set(Array.from(memoryVectors.values()).map(v => v.document_id)).size;
    
    return {
      totalChunks,
      totalDocuments: uniqueDocuments,
      averageChunksPerDocument: uniqueDocuments > 0 ? totalChunks / uniqueDocuments : 0,
    };
  }
}
