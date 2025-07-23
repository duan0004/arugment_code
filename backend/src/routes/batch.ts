import { Router, Request, Response } from 'express';
import { QueueService, JobType, DocumentProcessingJobData } from '../services/queueService';
import { DocumentService } from '../services/documentService';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// 创建批量AI处理任务
router.post('/ai-process', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileIds, operations } = req.body;
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      res.status(400).json({ success: false, message: '文件ID列表不能为空' });
      return;
    }

    if (!operations || typeof operations !== 'object') {
      res.status(400).json({ success: false, message: '操作配置不能为空' });
      return;
    }

    // 验证文件存在性和权限
    const files = [];
    for (const fileId of fileIds) {
      const document = await DocumentService.getDocumentByFileId(fileId);
      if (!document) {
        res.status(404).json({ success: false, message: `文档 ${fileId} 不存在` });
        return;
      }
      
      // 权限检查
      if (document.user_id && req.user?.id !== document.user_id && req.user?.role !== 'admin') {
        res.status(403).json({ success: false, message: `无权处理文档 ${fileId}` });
        return;
      }
      
      files.push({
        fileId: document.file_id,
        originalName: document.original_name,
        filePath: document.file_path,
        fileSize: Number(document.file_size),
        mimeType: 'application/pdf', // 简化处理
      });
    }

    // 生成批次ID
    const batchId = uuidv4();
    
    // 创建批量AI处理任务
    const jobData: DocumentProcessingJobData = {
      type: JobType.PROCESS_BATCH_DOCUMENTS,
      batchId,
      userId: req.user?.id,
      files,
      options: {
        generateSummary: operations.generateSummary || false,
        extractKeywords: operations.extractKeywords || false,
        vectorize: operations.vectorize || false,
        deleteAfterProcessing: false, // AI处理不删除原文件
      },
    };

    const jobId = await QueueService.addDocumentProcessingJob(jobData);

    res.json({
      success: true,
      message: '批量AI处理任务已创建',
      data: {
        batchId,
        jobId,
        totalFiles: files.length,
        operations,
        status: 'queued',
        createdAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('创建批量AI处理任务错误:', error);
    res.status(500).json({ success: false, message: '创建批量AI处理任务失败' });
  }
});

// 批量删除文档
router.delete('/documents', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileIds } = req.body;
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      res.status(400).json({ success: false, message: '文件ID列表不能为空' });
      return;
    }

    const results = [];
    
    for (const fileId of fileIds) {
      try {
        // 检查文档权限
        const document = await DocumentService.getDocumentByFileId(fileId);
        if (!document) {
          results.push({
            fileId,
            status: 'failed',
            error: '文档不存在'
          });
          continue;
        }
        
        // 权限检查
        if (document.user_id && req.user?.id !== document.user_id && req.user?.role !== 'admin') {
          results.push({
            fileId,
            status: 'failed',
            error: '无权删除此文档'
          });
          continue;
        }
        
        // 删除文档
        const success = await DocumentService.deleteDocument(fileId);
        results.push({
          fileId,
          status: success ? 'completed' : 'failed',
          error: success ? undefined : '删除失败'
        });
        
      } catch (error) {
        results.push({
          fileId,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const successCount = results.filter(r => r.status === 'completed').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      message: `批量删除完成，成功 ${successCount} 个，失败 ${failedCount} 个`,
      data: {
        totalFiles: fileIds.length,
        successCount,
        failedCount,
        results
      }
    });
  } catch (error) {
    console.error('批量删除文档错误:', error);
    res.status(500).json({ success: false, message: '批量删除文档失败' });
  }
});

// 获取用户的所有批量任务
router.get('/jobs', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    // 这里简化实现，实际应该从数据库或队列中获取用户的任务
    const stats = await QueueService.getQueueStats();
    
    res.json({
      success: true,
      message: '获取批量任务列表成功',
      data: {
        jobs: [], // 简化实现，实际应该返回用户的任务列表
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
        stats
      }
    });
  } catch (error) {
    console.error('获取批量任务列表错误:', error);
    res.status(500).json({ success: false, message: '获取批量任务列表失败' });
  }
});

// 重试失败的批量任务
router.post('/retry/:batchId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
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

    // 检查是否有失败的任务
    const failedJobs = jobs.filter(job => job.status === 'failed');
    
    if (failedJobs.length === 0) {
      res.status(400).json({ success: false, message: '没有失败的任务需要重试' });
      return;
    }

    // 这里简化实现，实际应该重新创建失败的任务
    res.json({
      success: true,
      message: `找到 ${failedJobs.length} 个失败任务，重试功能开发中`,
      data: {
        batchId,
        failedJobs: failedJobs.length,
        totalJobs: jobs.length,
      }
    });
  } catch (error) {
    console.error('重试批量任务错误:', error);
    res.status(500).json({ success: false, message: '重试批量任务失败' });
  }
});

// 获取批量处理性能统计
router.get('/performance', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await QueueService.getQueueStats();
    
    // 简化的性能统计
    const performance = {
      queueStats: stats,
      averageProcessingTime: '2.5秒/文档', // 模拟数据
      throughput: '24文档/分钟', // 模拟数据
      successRate: '95.2%', // 模拟数据
      peakHours: ['09:00-11:00', '14:00-16:00'], // 模拟数据
      recommendations: [
        '建议在非高峰时段进行大批量处理',
        '单次批量处理建议不超过50个文档',
        'PDF文件建议压缩后上传以提高处理速度'
      ]
    };

    res.json({
      success: true,
      message: '获取批量处理性能统计成功',
      data: performance
    });
  } catch (error) {
    console.error('获取性能统计错误:', error);
    res.status(500).json({ success: false, message: '获取性能统计失败' });
  }
});

// 清理已完成的批量任务
router.post('/cleanup', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // 只有管理员可以执行清理操作
    if (req.user?.role !== 'admin') {
      res.status(403).json({ success: false, message: '需要管理员权限' });
      return;
    }

    await QueueService.cleanupJobs();

    res.json({
      success: true,
      message: '批量任务清理完成',
      data: {
        cleanedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('清理批量任务错误:', error);
    res.status(500).json({ success: false, message: '清理批量任务失败' });
  }
});

export default router;
