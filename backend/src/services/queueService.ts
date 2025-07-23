import Bull from 'bull';
import Redis from 'ioredis';
import { DocumentService } from './documentService';
import { VectorService } from './vectorService';
import fs from 'fs';
// @ts-ignore
import pdfParse from 'pdf-parse';

// Redis配置
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let redis: Redis | null = null;

// 初始化Redis连接
try {
  // 暂时禁用Redis连接，直接使用内存队列
  const useRedis = false; // 设置为false以禁用Redis
  if (useRedis && (process.env.REDIS_URL || process.env.NODE_ENV === 'production')) {
    redis = new Redis(REDIS_URL);
    console.log('✅ Redis队列服务已初始化');
  } else {
    console.warn('⚠️  Redis未配置，将使用内存队列');
  }
} catch (error) {
  console.error('❌ Redis连接失败:', error);
  console.warn('⚠️  将使用内存队列作为备选方案');
}

// 队列配置
const queueOptions = redis ? {
  redis: {
    port: 6379,
    host: 'localhost',
  }
} : undefined;

// 创建队列
export const documentProcessingQueue = redis ? 
  new Bull('document processing', queueOptions) : 
  null;

// 内存队列备选方案
interface MemoryJob {
  id: string;
  data: any;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const memoryJobs = new Map<string, MemoryJob>();
const memoryQueue: MemoryJob[] = [];
let isProcessing = false;
let jobIdCounter = 1;

// 任务类型
export enum JobType {
  PROCESS_SINGLE_DOCUMENT = 'process_single_document',
  PROCESS_BATCH_DOCUMENTS = 'process_batch_documents',
  GENERATE_SUMMARY = 'generate_summary',
  EXTRACT_KEYWORDS = 'extract_keywords',
  VECTORIZE_DOCUMENT = 'vectorize_document',
}

// 任务数据接口
export interface DocumentProcessingJobData {
  type: JobType;
  batchId?: string;
  userId?: string;
  files: Array<{
    fileId: string;
    originalName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
  }>;
  options?: {
    generateSummary?: boolean;
    extractKeywords?: boolean;
    vectorize?: boolean;
    deleteAfterProcessing?: boolean;
  };
}

export interface JobProgress {
  jobId: string;
  batchId?: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  total: number;
  processed: number;
  failed: number;
  currentFile?: string;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class QueueService {
  // 添加文档处理任务
  static async addDocumentProcessingJob(data: DocumentProcessingJobData): Promise<string> {
    if (documentProcessingQueue) {
      try {
        const job = await documentProcessingQueue.add(data.type, data, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 10,
          removeOnFail: 5,
        });
        return job.id.toString();
      } catch (error) {
        console.error('添加队列任务失败，降级到内存队列:', error);
        return this.addMemoryJob(data);
      }
    } else {
      return this.addMemoryJob(data);
    }
  }

  // 内存队列添加任务
  private static addMemoryJob(data: DocumentProcessingJobData): string {
    const jobId = `job_${jobIdCounter++}`;
    const now = new Date();
    
    const memoryJob: MemoryJob = {
      id: jobId,
      data,
      status: 'waiting',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    memoryJobs.set(jobId, memoryJob);
    memoryQueue.push(memoryJob);
    
    // 启动内存队列处理
    this.processMemoryQueue();
    
    return jobId;
  }

  // 处理内存队列
  private static async processMemoryQueue(): Promise<void> {
    if (isProcessing || memoryQueue.length === 0) return;
    
    isProcessing = true;
    
    while (memoryQueue.length > 0) {
      const job = memoryQueue.shift();
      if (!job) break;
      
      try {
        job.status = 'active';
        job.updatedAt = new Date();
        
        const result = await this.processJob(job.data, (progress) => {
          job.progress = progress;
          job.updatedAt = new Date();
        });
        
        job.status = 'completed';
        job.result = result;
        job.progress = 100;
        job.updatedAt = new Date();
        
      } catch (error) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
        job.updatedAt = new Date();
        console.error(`内存队列任务 ${job.id} 失败:`, error);
      }
    }
    
    isProcessing = false;
  }

  // 处理任务
  private static async processJob(
    data: DocumentProcessingJobData, 
    progressCallback: (progress: number) => void
  ): Promise<any> {
    const { type, files, options = {} } = data;
    const results: any[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      progressCallback(Math.round((i / files.length) * 100));

      try {
        let textContent = '';
        let pageCount = 1;

        // 解析文件内容
        if (file.mimeType === 'application/pdf') {
          const dataBuffer = fs.readFileSync(file.filePath);
          const pdfData = await pdfParse(dataBuffer);
          pageCount = pdfData.numpages;
          textContent = pdfData.text;
        } else if (file.mimeType === 'text/plain') {
          textContent = fs.readFileSync(file.filePath, 'utf-8');
        }

        // 创建文档记录
        const document = await DocumentService.createDocument({
          file_id: file.fileId,
          original_name: file.originalName,
          file_size: file.fileSize,
          page_count: pageCount,
          text_content: textContent,
          file_path: file.filePath,
          user_id: data.userId,
        });

        const fileResult: any = {
          fileId: file.fileId,
          originalName: file.originalName,
          status: 'completed',
          document: {
            id: document.id,
            file_id: document.file_id,
            page_count: document.page_count,
            file_size: Number(document.file_size),
          }
        };

        // 可选处理
        if (options.vectorize && textContent) {
          try {
            await VectorService.processDocumentVectorization(document.id, textContent);
            fileResult.vectorized = true;
          } catch (error) {
            console.warn(`文档 ${file.fileId} 向量化失败:`, error);
            fileResult.vectorized = false;
          }
        }

        // 删除临时文件
        if (options.deleteAfterProcessing) {
          try {
            fs.unlinkSync(file.filePath);
          } catch (error) {
            console.warn(`删除临时文件失败: ${file.filePath}`, error);
          }
        }

        results.push(fileResult);

      } catch (error) {
        console.error(`处理文件 ${file.originalName} 失败:`, error);
        results.push({
          fileId: file.fileId,
          originalName: file.originalName,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    progressCallback(100);
    return {
      batchId: data.batchId,
      totalFiles: files.length,
      processedFiles: results.filter(r => r.status === 'completed').length,
      failedFiles: results.filter(r => r.status === 'failed').length,
      results,
    };
  }

  // 获取任务状态
  static async getJobStatus(jobId: string): Promise<JobProgress | null> {
    if (documentProcessingQueue) {
      try {
        const job = await documentProcessingQueue.getJob(jobId);
        if (!job) return null;

        return {
          jobId: job.id.toString(),
          batchId: job.data.batchId,
          status: job.finishedOn ? 'completed' : job.failedReason ? 'failed' : job.processedOn ? 'active' : 'waiting',
          progress: 0, // 简化处理
          total: job.data.files?.length || 0,
          processed: 0, // 需要从结果中计算
          failed: 0, // 需要从结果中计算
          currentFile: job.data.currentFile,
          result: job.returnvalue,
          error: job.failedReason,
          createdAt: new Date(job.timestamp),
          updatedAt: new Date(job.processedOn || job.timestamp),
        };
      } catch (error) {
        console.error('获取队列任务状态失败，尝试内存队列:', error);
        return this.getMemoryJobStatus(jobId);
      }
    } else {
      return this.getMemoryJobStatus(jobId);
    }
  }

  // 获取内存任务状态
  private static getMemoryJobStatus(jobId: string): JobProgress | null {
    const job = memoryJobs.get(jobId);
    if (!job) return null;
    
    const total = job.data.files?.length || 0;
    const processed = job.result?.processedFiles || 0;
    const failed = job.result?.failedFiles || 0;
    
    return {
      jobId: job.id,
      batchId: job.data.batchId,
      status: job.status,
      progress: job.progress,
      total,
      processed,
      failed,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  // 获取批量任务状态
  static async getBatchStatus(batchId: string): Promise<JobProgress[]> {
    const jobs: JobProgress[] = [];
    
    if (documentProcessingQueue) {
      try {
        const waiting = await documentProcessingQueue.getWaiting();
        const active = await documentProcessingQueue.getActive();
        const completed = await documentProcessingQueue.getCompleted();
        const failed = await documentProcessingQueue.getFailed();
        
        const allJobs = [...waiting, ...active, ...completed, ...failed];
        
        for (const job of allJobs) {
          if (job.data.batchId === batchId) {
            const status = await this.getJobStatus(job.id.toString());
            if (status) jobs.push(status);
          }
        }
      } catch (error) {
        console.error('获取批量任务状态失败，尝试内存队列:', error);
      }
    }
    
    // 检查内存队列
    for (const [jobId, job] of memoryJobs.entries()) {
      if (job.data.batchId === batchId) {
        const status = this.getMemoryJobStatus(jobId);
        if (status) jobs.push(status);
      }
    }
    
    return jobs;
  }

  // 取消任务
  static async cancelJob(jobId: string): Promise<boolean> {
    if (documentProcessingQueue) {
      try {
        const job = await documentProcessingQueue.getJob(jobId);
        if (job) {
          await job.remove();
          return true;
        }
      } catch (error) {
        console.error('取消队列任务失败:', error);
      }
    }
    
    // 取消内存任务
    const job = memoryJobs.get(jobId);
    if (job && job.status === 'waiting') {
      const index = memoryQueue.findIndex(j => j.id === jobId);
      if (index !== -1) {
        memoryQueue.splice(index, 1);
        memoryJobs.delete(jobId);
        return true;
      }
    }
    
    return false;
  }

  // 清理已完成的任务
  static async cleanupJobs(): Promise<void> {
    if (documentProcessingQueue) {
      try {
        await documentProcessingQueue.clean(24 * 60 * 60 * 1000, 'completed'); // 清理24小时前的已完成任务
        await documentProcessingQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // 清理7天前的失败任务
      } catch (error) {
        console.error('清理队列任务失败:', error);
      }
    }
    
    // 清理内存任务
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    for (const [jobId, job] of memoryJobs.entries()) {
      if (job.status === 'completed' && job.updatedAt < oneDayAgo) {
        memoryJobs.delete(jobId);
      }
    }
  }

  // 获取队列统计
  static async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    if (documentProcessingQueue) {
      try {
        const [waiting, active, completed, failed] = await Promise.all([
          documentProcessingQueue.getWaiting(),
          documentProcessingQueue.getActive(),
          documentProcessingQueue.getCompleted(),
          documentProcessingQueue.getFailed(),
        ]);
        
        return {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          total: waiting.length + active.length + completed.length + failed.length,
        };
      } catch (error) {
        console.error('获取队列统计失败:', error);
      }
    }
    
    // 内存队列统计
    const stats = { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 };
    
    for (const job of memoryJobs.values()) {
      stats[job.status]++;
      stats.total++;
    }
    
    return stats;
  }
}

// 如果使用Redis队列，设置任务处理器
if (documentProcessingQueue) {
  documentProcessingQueue.process('*', async (job) => {
    return await QueueService['processJob'](job.data, (progress) => {
      job.progress(progress);
    });
  });
  
  // 队列事件监听
  documentProcessingQueue.on('completed', (job, result) => {
    console.log(`✅ 任务 ${job.id} 完成:`, result.totalFiles, '个文件处理完成');
  });
  
  documentProcessingQueue.on('failed', (job, err) => {
    console.error(`❌ 任务 ${job.id} 失败:`, err.message);
  });
  
  documentProcessingQueue.on('progress', (job, progress) => {
    console.log(`📊 任务 ${job.id} 进度: ${progress}%`);
  });
}
