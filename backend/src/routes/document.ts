import { Router, Request, Response } from 'express';
import { DocumentService } from '../services/documentService';
import { optionalAuth, authenticateToken, requireOwnerOrAdmin } from '../middleware/auth';

const router = Router();

// 获取文档列表（支持用户过滤）
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const user_id = req.user?.id; // 如果用户已登录，只显示其文档

    const result = await DocumentService.getDocuments(user_id, page, limit);

    // 格式化返回数据
    const documentList = result.documents.map(doc => ({
      file_id: doc.file_id,
      original_name: doc.original_name,
      file_size: Number(doc.file_size),
      page_count: doc.page_count,
      upload_time: doc.created_at.toISOString(),
      has_summary: !!doc.summary,
      has_keywords: doc.keywords && doc.keywords.length > 0
    }));

    res.json({
      success: true,
      data: {
        documents: documentList,
        total: result.total,
        page: result.page,
        limit: result.limit
      }
    });
  } catch (error) {
    console.error('获取文档列表错误:', error);
    res.status(500).json({ success: false, message: '获取文档列表失败' });
  }
});

// 获取文档详情（需要权限检查）
router.get('/:file_id', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const file_id = req.params.file_id;
    if (!file_id) {
      res.status(400).json({ success: false, message: '文件ID不能为空' });
      return;
    }

    const document = await DocumentService.getDocumentByFileId(file_id);

    if (!document) {
      res.status(404).json({ success: false, message: '文档不存在' });
      return;
    }

    // 权限检查：只有文档所有者或管理员可以查看私有文档
    if (document.user_id && req.user?.id !== document.user_id && req.user?.role !== 'admin') {
      res.status(403).json({ success: false, message: '无权访问此文档' });
      return;
    }

    res.json({
      success: true,
      data: {
        file_id: document.file_id,
        original_name: document.original_name,
        file_size: Number(document.file_size),
        page_count: document.page_count,
        upload_time: document.created_at.toISOString(),
        summary: document.summary,
        keywords: document.keywords,
        text_preview: document.text_content ? document.text_content.substring(0, 500) : '',
        qa_history: document.qa_history || []
      }
    });
  } catch (error) {
    console.error('获取文档详情错误:', error);
    res.status(500).json({ success: false, message: '获取文档详情失败' });
  }
});

// 删除文档（需要所有者权限）
router.delete('/:file_id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const file_id = req.params.file_id;
    if (!file_id) {
      res.status(400).json({ success: false, message: '文件ID不能为空' });
      return;
    }

    // 检查文档权限
    const document = await DocumentService.getDocumentByFileId(file_id);
    if (!document) {
      res.status(404).json({ success: false, message: '文档不存在' });
      return;
    }

    // 权限检查：只有文档所有者或管理员可以删除
    if (document.user_id && req.user?.id !== document.user_id && req.user?.role !== 'admin') {
      res.status(403).json({ success: false, message: '无权删除此文档' });
      return;
    }

    const success = await DocumentService.deleteDocument(file_id);

    if (!success) {
      res.status(404).json({ success: false, message: '文档不存在或删除失败' });
      return;
    }

    res.json({
      success: true,
      message: '文档删除成功'
    });
  } catch (error) {
    console.error('删除文档错误:', error);
    res.status(500).json({ success: false, message: '删除文档失败' });
  }
});

// 获取文档统计信息
router.get('/stats/overview', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user_id = req.user?.id; // 如果用户已登录，只统计其文档
    const stats = await DocumentService.getDocumentStats(user_id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取文档统计错误:', error);
    res.status(500).json({ success: false, message: '获取文档统计失败' });
  }
});

export default router;
 