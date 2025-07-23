import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { DocumentService } from '../services/documentService';
import { VectorService } from '../services/vectorService';
import { QueueService, JobType, DocumentProcessingJobData } from '../services/queueService';
import { optionalAuth, authenticateToken } from '../middleware/auth';
// @ts-ignore
import pdfParse from 'pdf-parse';

const router = Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  }
});

// 文件过滤器
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
    cb(null, true);
  } else {
    cb(new Error('只支持PDF和文本文件格式'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  }
});

// 上传PDF文件并自动解析（支持用户关联）
router.post('/pdf', optionalAuth, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: '请选择要上传的PDF文件',
        data: null
      });
      return;
    }
    const file = req.file;
    const fileId = path.parse(file.filename).name;
    let pageCount = 0;
    let textContent = '';

    if (file.mimetype === 'application/pdf') {
      try {
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdfParse(dataBuffer);
        pageCount = pdfData.numpages;
        textContent = pdfData.text;
      } catch (err: any) {
        console.error('PDF解析失败:', err);
        pageCount = 1; // 默认为1页
        textContent = ''; // 解析失败时内容为空
      }
    } else if (file.mimetype === 'text/plain') {
      try {
        textContent = fs.readFileSync(file.path, 'utf-8');
        pageCount = 1; // 文本文件默认为1页
      } catch (err: any) {
        console.error('文本文件读取失败:', err);
        pageCount = 1;
        textContent = '';
      }
    }
    // 保存到数据库
    const document = await DocumentService.createDocument({
      file_id: fileId,
      original_name: file.originalname,
      file_size: file.size,
      page_count: pageCount,
      text_content: textContent,
      file_path: file.path,
      user_id: req.user?.id, // 关联当前登录用户
    });

    // 异步处理向量化（不阻塞响应）
    if (textContent && textContent.trim().length > 0) {
      VectorService.processDocumentVectorization(document.id, textContent)
        .then((success) => {
          if (success) {
            console.log(`✅ 文档 ${fileId} 向量化完成`);
          } else {
            console.warn(`⚠️  文档 ${fileId} 向量化失败`);
          }
        })
        .catch((error) => {
          console.error(`❌ 文档 ${fileId} 向量化错误:`, error);
        });
    }

    res.json({
      success: true,
      message: 'PDF文件上传并解析成功',
      data: {
        file_id: document.file_id,
        original_name: document.original_name,
        page_count: document.page_count,
        file_size: Number(document.file_size),
        upload_time: document.created_at.toISOString(),
        vectorization_status: textContent && textContent.trim().length > 0 ? 'processing' : 'skipped'
      }
    });
  } catch (error) {
    console.error('PDF上传错误:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '文件上传失败',
      data: null
    });
  }
});

// 批量文件上传
router.post('/batch', optionalAuth, upload.array('files', 10), async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: '没有上传文件' });
      return;
    }

    if (files.length > 10) {
      res.status(400).json({ success: false, message: '最多只能同时上传10个文件' });
      return;
    }

    // 生成批次ID
    const batchId = uuidv4();

    // 准备批量处理数据
    const jobFiles = files.map(file => ({
      fileId: uuidv4(),
      originalName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
    }));

    // 处理选项
    const options = {
      generateSummary: req.body.generateSummary === 'true',
      extractKeywords: req.body.extractKeywords === 'true',
      vectorize: req.body.vectorize === 'true',
      deleteAfterProcessing: req.body.deleteAfterProcessing !== 'false', // 默认删除临时文件
    };

    // 创建批量处理任务
    const jobData: DocumentProcessingJobData = {
      type: JobType.PROCESS_BATCH_DOCUMENTS,
      batchId,
      userId: req.user?.id,
      files: jobFiles,
      options,
    };

    const jobId = await QueueService.addDocumentProcessingJob(jobData);

    res.json({
      success: true,
      message: '批量上传任务已创建',
      data: {
        batchId,
        jobId,
        totalFiles: files.length,
        files: jobFiles.map(f => ({
          fileId: f.fileId,
          originalName: f.originalName,
          fileSize: f.fileSize,
        })),
        options,
        status: 'queued',
        createdAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('批量上传错误:', error);
    res.status(500).json({ success: false, message: '批量上传失败' });
  }
});

// 获取批量处理状态
router.get('/batch/:batchId/status', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      res.status(400).json({ success: false, message: '批次ID不能为空' });
      return;
    }

    const jobs = await QueueService.getBatchStatus(batchId);

    if (jobs.length === 0) {
      res.status(404).json({ success: false, message: '批次不存在' });
      return;
    }

    // 计算总体状态
    const totalFiles = jobs.reduce((sum, job) => sum + job.total, 0);
    const processedFiles = jobs.reduce((sum, job) => sum + job.processed, 0);
    const failedFiles = jobs.reduce((sum, job) => sum + job.failed, 0);

    const overallStatus = jobs.every(job => job.status === 'completed') ? 'completed' :
                         jobs.some(job => job.status === 'failed') ? 'partial' :
                         jobs.some(job => job.status === 'active') ? 'processing' : 'waiting';

    const overallProgress = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0;

    res.json({
      success: true,
      message: '获取批量处理状态成功',
      data: {
        batchId,
        status: overallStatus,
        progress: overallProgress,
        totalFiles,
        processedFiles,
        failedFiles,
        jobs: jobs.map(job => ({
          jobId: job.jobId,
          status: job.status,
          progress: job.progress,
          total: job.total,
          processed: job.processed,
          failed: job.failed,
          error: job.error,
          updatedAt: job.updatedAt,
        })),
        updatedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('获取批量处理状态错误:', error);
    res.status(500).json({ success: false, message: '获取批量处理状态失败' });
  }
});

// 获取单个任务状态
router.get('/job/:jobId/status', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({ success: false, message: '任务ID不能为空' });
      return;
    }

    const job = await QueueService.getJobStatus(jobId);

    if (!job) {
      res.status(404).json({ success: false, message: '任务不存在' });
      return;
    }

    res.json({
      success: true,
      message: '获取任务状态成功',
      data: job
    });
  } catch (error) {
    console.error('获取任务状态错误:', error);
    res.status(500).json({ success: false, message: '获取任务状态失败' });
  }
});

// 取消批量处理任务
router.delete('/batch/:batchId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      res.status(400).json({ success: false, message: '批次ID不能为空' });
      return;
    }

    const jobs = await QueueService.getBatchStatus(batchId);

    if (jobs.length === 0) {
      res.status(404).json({ success: false, message: '批次不存在' });
      return;
    }

    let cancelledCount = 0;
    for (const job of jobs) {
      if (job.status === 'waiting') {
        const cancelled = await QueueService.cancelJob(job.jobId);
        if (cancelled) cancelledCount++;
      }
    }

    res.json({
      success: true,
      message: `批量任务取消成功，共取消 ${cancelledCount} 个等待中的任务`,
      data: {
        batchId,
        cancelledJobs: cancelledCount,
        totalJobs: jobs.length,
      }
    });
  } catch (error) {
    console.error('取消批量任务错误:', error);
    res.status(500).json({ success: false, message: '取消批量任务失败' });
  }
});

// 获取队列统计信息
router.get('/queue/stats', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await QueueService.getQueueStats();

    res.json({
      success: true,
      message: '获取队列统计成功',
      data: stats
    });
  } catch (error) {
    console.error('获取队列统计错误:', error);
    res.status(500).json({ success: false, message: '获取队列统计失败' });
  }
});

export default router;
