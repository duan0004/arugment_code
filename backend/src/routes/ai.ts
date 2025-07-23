import { Router, Request, Response } from 'express';
import { DocumentService } from '../services/documentService';
import axios from 'axios';

const router = Router();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

// 检查API密钥是否配置
if (!DEEPSEEK_API_KEY) {
  console.warn('⚠️  DEEPSEEK_API_KEY 未配置，AI功能将不可用');
}

async function callDeepSeek(messages: any[], max_tokens = 512, temperature = 0.2): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    return 'DeepSeek API密钥未配置，请在环境变量中设置 DEEPSEEK_API_KEY';
  }

  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: MODEL,
        messages,
        max_tokens,
        temperature
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    return response.data.choices?.[0]?.message?.content || '';
  } catch (err: any) {
    console.error('DeepSeek API error:', err?.response?.data || err.message);
    return 'AI服务暂不可用，请检查API Key或网络。';
  }
}

// 智能问答接口（调用DeepSeek）
router.post('/ask', async (req: Request, res: Response): Promise<void> => {
  try {
    const { file_id, question } = req.body;
    if (!file_id || !question) {
      res.status(400).json({ success: false, message: '文件ID和问题不能为空' });
      return;
    }

    const document = await DocumentService.getDocumentByFileId(file_id);
    if (!document) {
      res.status(404).json({ success: false, message: '文档不存在' });
      return;
    }

    // 调用DeepSeek
    const answer = await callDeepSeek([
      { role: 'system', content: '你是一个专业的学术助手，请根据文档内容回答用户问题。' },
      { role: 'user', content: `文档内容：${document.text_content}\n\n问题：${question}` }
    ]);

    // 保存问答记录到数据库
    await DocumentService.addQAHistory(document.id, question, answer);

    res.json({
      success: true,
      message: '问答成功',
      data: { file_id, question, answer, answered_at: new Date().toISOString() }
    });
  } catch (error) {
    console.error('问答错误:', error);
    res.status(500).json({ success: false, message: '问答失败' });
  }
});

// 生成摘要接口（调用DeepSeek）
router.post('/summarize', async (req: Request, res: Response): Promise<void> => {
  try {
    const { file_id } = req.body;
    if (!file_id) {
      res.status(400).json({ success: false, message: '文件ID不能为空' });
      return;
    }

    const document = await DocumentService.getDocumentByFileId(file_id);
    if (!document) {
      res.status(404).json({ success: false, message: '文档不存在' });
      return;
    }

    // 调用DeepSeek，要求返回严格JSON
    const prompt = `请你作为专业论文分析助手，根据以下PDF文献段落，输出结构化总结，返回格式为严格的JSON，不要有多余解释。字段包括：\n{\n  "purpose": "研究目的",\n  "method": "方法概述",\n  "finding": "关键发现",\n  "conclusion": "结论总结",\n  "keywords": "关键词1, 关键词2, ..."\n}\n文献段落如下：${document.text_content?.substring(0, 3000) || ''}`;
    const aiResponse = await callDeepSeek([
      { role: 'system', content: '你是一个专业的论文分析助手，请严格按照用户要求返回结构化JSON。' },
      { role: 'user', content: prompt }
    ], 1024, 0.2);

    // 尝试解析AI返回内容为JSON
    let summaryJson: any = null;
    try {
      // 先直接尝试JSON.parse
      summaryJson = JSON.parse(aiResponse);
    } catch (e) {
      // 如果AI返回内容不是严格JSON，尝试用正则提取JSON部分
      const match = aiResponse.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          summaryJson = JSON.parse(match[0]);
        } catch (e2) {
          summaryJson = null;
        }
      }
    }

    if (!summaryJson) {
      res.json({
        success: false,
        message: 'AI返回内容无法解析为结构化JSON',
        data: { file_id, raw: aiResponse }
      });
      return;
    }

    // 保存摘要到数据库
    await DocumentService.updateDocumentSummary(file_id, summaryJson);

    res.json({
      success: true,
      message: '摘要生成成功',
      data: {
        file_id,
        ...summaryJson,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('摘要生成错误:', error);
    res.status(500).json({ success: false, message: '摘要生成失败' });
  }
});

// 关键词提取接口（调用DeepSeek）
router.post('/keywords', async (req: Request, res: Response): Promise<void> => {
  try {
    const { file_id } = req.body;
    if (!file_id) {
      res.status(400).json({ success: false, message: '文件ID不能为空' });
      return;
    }

    const document = await DocumentService.getDocumentByFileId(file_id);
    if (!document) {
      res.status(404).json({ success: false, message: '文档不存在' });
      return;
    }

    // 调用DeepSeek提取关键词
    const prompt = `请从以下文档内容中提取5-10个最重要的关键词，用逗号分隔，只返回关键词列表，不要其他解释：\n\n${document.text_content?.substring(0, 2000) || ''}`;
    const aiResponse = await callDeepSeek([
      { role: 'system', content: '你是一个专业的关键词提取助手，请从文档中提取最重要的关键词。' },
      { role: 'user', content: prompt }
    ], 256, 0.1);

    // 解析关键词
    const keywords = aiResponse.split(',').map(k => k.trim()).filter(k => k.length > 0);

    // 保存关键词到数据库
    await DocumentService.updateDocumentKeywords(file_id, keywords);

    res.json({
      success: true,
      message: '关键词提取成功',
      data: {
        file_id,
        keywords,
        extracted_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('关键词提取错误:', error);
    res.status(500).json({ success: false, message: '关键词提取失败' });
  }
});

export default router;
