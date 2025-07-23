import { Router, Request, Response } from 'express';
import { VectorService } from '../services/vectorService';
import { DocumentService } from '../services/documentService';

const router = Router();

// 为文档生成向量
router.post('/vectorize/:file_id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { file_id } = req.params;
    if (!file_id) {
      res.status(400).json({ success: false, message: '文件ID不能为空' });
      return;
    }

    // 获取文档
    const document = await DocumentService.getDocumentByFileId(file_id);
    if (!document) {
      res.status(404).json({ success: false, message: '文档不存在' });
      return;
    }

    if (!document.text_content) {
      res.status(400).json({ success: false, message: '文档没有文本内容' });
      return;
    }

    // 处理向量化
    const success = await VectorService.processDocumentVectorization(document.id, document.text_content);
    
    if (success) {
      res.json({
        success: true,
        message: '文档向量化成功',
        data: {
          file_id,
          document_id: document.id,
          processed_at: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: '文档向量化失败'
      });
    }
  } catch (error) {
    console.error('向量化错误:', error);
    res.status(500).json({ success: false, message: '向量化处理失败' });
  }
});

// 语义搜索
router.post('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, document_id, limit = 5 } = req.body;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({ success: false, message: '搜索查询不能为空' });
      return;
    }

    const results = await VectorService.semanticSearch(query, document_id, limit);
    
    res.json({
      success: true,
      message: '语义搜索成功',
      data: {
        query,
        results,
        total: results.length,
        searched_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('语义搜索错误:', error);
    res.status(500).json({ success: false, message: '语义搜索失败' });
  }
});

// 获取文档分块
router.get('/chunks/:file_id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { file_id } = req.params;
    if (!file_id) {
      res.status(400).json({ success: false, message: '文件ID不能为空' });
      return;
    }

    // 获取文档
    const document = await DocumentService.getDocumentByFileId(file_id);
    if (!document) {
      res.status(404).json({ success: false, message: '文档不存在' });
      return;
    }

    // 获取分块
    const chunks = await VectorService.getDocumentChunks(document.id);
    
    res.json({
      success: true,
      message: '获取文档分块成功',
      data: {
        file_id,
        document_id: document.id,
        chunks,
        total_chunks: chunks.length
      }
    });
  } catch (error) {
    console.error('获取分块错误:', error);
    res.status(500).json({ success: false, message: '获取文档分块失败' });
  }
});

// 删除文档向量
router.delete('/vectors/:file_id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { file_id } = req.params;
    if (!file_id) {
      res.status(400).json({ success: false, message: '文件ID不能为空' });
      return;
    }

    // 获取文档
    const document = await DocumentService.getDocumentByFileId(file_id);
    if (!document) {
      res.status(404).json({ success: false, message: '文档不存在' });
      return;
    }

    // 删除向量
    const success = await VectorService.deleteDocumentVectors(document.id);
    
    if (success) {
      res.json({
        success: true,
        message: '文档向量删除成功',
        data: {
          file_id,
          document_id: document.id,
          deleted_at: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: '文档向量删除失败'
      });
    }
  } catch (error) {
    console.error('删除向量错误:', error);
    res.status(500).json({ success: false, message: '删除文档向量失败' });
  }
});

// 获取向量化统计信息
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await VectorService.getVectorStats();
    
    res.json({
      success: true,
      message: '获取向量化统计成功',
      data: stats
    });
  } catch (error) {
    console.error('获取向量化统计错误:', error);
    res.status(500).json({ success: false, message: '获取向量化统计失败' });
  }
});

// 文本分块预览（用于调试）
router.post('/preview-chunks', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      res.status(400).json({ success: false, message: '文本内容不能为空' });
      return;
    }

    const chunks = VectorService.splitText(text);
    
    res.json({
      success: true,
      message: '文本分块预览成功',
      data: {
        original_length: text.length,
        chunks: chunks.map((chunk, index) => ({
          index,
          content: chunk,
          length: chunk.length
        })),
        total_chunks: chunks.length
      }
    });
  } catch (error) {
    console.error('文本分块预览错误:', error);
    res.status(500).json({ success: false, message: '文本分块预览失败' });
  }
});

export default router;
