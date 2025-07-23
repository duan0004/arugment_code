'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft, FiDownload, FiMessageCircle, FiKey, FiFileText } from 'react-icons/fi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

interface DocumentDetail {
  file_id: string;
  original_name: string;
  file_size: number;
  page_count: number;
  upload_time: string;
  summary?: string;
  keywords?: string[];
  text_preview: string;
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchDocument(params.id as string);
    }
  }, [params.id]);

  const fetchDocument = async (fileId: string) => {
    try {
      // 彻底写死API路径，排除环境变量干扰
      const apiBase = 'http://localhost:8000';
      const response = await fetch(`${apiBase}/api/documents/${fileId}`);
      if (!response.ok) {
        throw new Error('获取文档失败');
      }
      const result = await response.json();
      setDocument(result.data);
    } catch (error) {
      console.error('获取文档错误:', error);
      toast.error('获取文档失败');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    if (!document) return;
    
    setGenerating(true);
    try {
      const apiBase = 'http://localhost:8000';
      const response = await fetch(`${apiBase}/api/ai/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_id: document.file_id }),
      });

      if (!response.ok) {
        throw new Error('生成摘要失败');
      }

      const result = await response.json();
      setDocument(prev => prev ? { ...prev, ...result.data, summary: result.data.summary ? JSON.parse(JSON.stringify(result.data.summary)) : undefined } : null);
      toast.success('摘要生成成功');
      // 强制重新拉取文档，确保页面刷新
      await fetchDocument(document.file_id);
    } catch (error) {
      console.error('生成摘要错误:', error);
      toast.error('生成摘要失败');
    } finally {
      setGenerating(false);
    }
  };

  const generateKeywords = async () => {
    if (!document) return;
    
    setGenerating(true);
    try {
      const apiBase = 'http://localhost:8000';
      const response = await fetch(`${apiBase}/api/ai/keywords`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_id: document.file_id }),
      });

      if (!response.ok) {
        throw new Error('提取关键词失败');
      }

      const result = await response.json();
      setDocument(prev => prev ? { ...prev, keywords: result.data.keywords } : null);
      toast.success('关键词提取成功');
    } catch (error) {
      console.error('提取关键词错误:', error);
      toast.error('提取关键词失败');
    } finally {
      setGenerating(false);
    }
  };

  const askQuestion = async () => {
    if (!document || !question.trim()) return;
    
    setAskingQuestion(true);
    try {
      const apiBase = 'http://localhost:8000';
      const response = await fetch(`${apiBase}/api/ai/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          file_id: document.file_id,
          question: question.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('问答失败');
      }

      const result = await response.json();
      setAnswer(result.data.answer);
      toast.success('问答成功');
    } catch (error) {
      console.error('问答错误:', error);
      toast.error('问答失败');
    } finally {
      setAskingQuestion(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f6f7fa] to-[#e9ebf1] dark:from-darkbg dark:to-[#23232b] flex items-center justify-center animate-fade-in">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-300 text-lg font-medium">加载文档中...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f6f7fa] to-[#e9ebf1] dark:from-darkbg dark:to-[#23232b] flex items-center justify-center animate-fade-in">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-300 mb-4 text-lg">文档不存在</p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary text-lg px-8 py-2"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f7fa] to-[#e9ebf1] dark:from-darkbg dark:to-[#23232b] pb-20 pt-28 animate-fade-in">
      {/* 头部导航留白已由全局Header实现 */}
      <div className="container mx-auto px-2 sm:px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* 左侧主要内容 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 文档摘要 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card shadow-2xl rounded-3xl bg-white/80 dark:bg-darkglass backdrop-blur-md border border-gray-100 dark:border-gray-800 p-10 animate-fade-in"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <FiFileText className="w-6 h-6" />
                  智能摘要
                </h2>
                {!document.summary && (
                  <button
                    onClick={generateSummary}
                    disabled={generating}
                    className="btn-primary text-lg px-8 py-2"
                  >
                    {generating ? '生成中...' : '生成摘要'}
                  </button>
                )}
              </div>
              {document.summary && typeof document.summary === 'object' ? (
                <div className="space-y-4 text-left text-lg text-gray-900 dark:text-white">
                  <div><b>研究目的：</b>{(document.summary as any).purpose || '-'}</div>
                  <div><b>方法概述：</b>{(document.summary as any).method || '-'}</div>
                  <div><b>关键发现：</b>{(document.summary as any).finding || '-'}</div>
                  <div><b>结论总结：</b>{(document.summary as any).conclusion || '-'}</div>
                  <div><b>关键词：</b>{(document.summary as any).keywords || '-'}</div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-lg">
                  <FiFileText className="w-14 h-14 mx-auto mb-6 opacity-50" />
                  <p>点击"生成摘要"按钮开始AI分析</p>
                </div>
              )}
            </motion.div>

            {/* 智能问答 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card shadow-2xl rounded-3xl bg-white/80 dark:bg-darkglass backdrop-blur-md border border-gray-100 dark:border-gray-800 p-10 animate-fade-in"
            >
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <FiMessageCircle className="w-6 h-6" />
                智能问答
              </h2>
              <div className="space-y-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="input-field text-lg font-medium"
                    placeholder="请输入你的科研问题..."
                    disabled={askingQuestion}
                  />
                  <button
                    onClick={askQuestion}
                    className="btn-primary text-lg px-8 py-2 flex items-center gap-2"
                    disabled={askingQuestion || !question.trim()}
                  >
                    <FiMessageCircle className="w-5 h-5" />
                    提问
                  </button>
                </div>
                {askingQuestion && <div className="text-gray-400 dark:text-gray-300 text-base">AI思考中…</div>}
                {answer && <div className="mt-6 text-gray-900 dark:text-white whitespace-pre-line bg-gray-50 dark:bg-darkcard rounded-xl p-6 border border-gray-100 dark:border-gray-800 text-lg font-medium shadow-inner">{answer}</div>}
              </div>
            </motion.div>
          </div>
          {/* 右侧文档信息 */}
          <div className="space-y-8">
            <div className="card shadow-xl rounded-3xl bg-white/80 dark:bg-darkglass backdrop-blur-md border border-gray-100 dark:border-gray-800 p-8 animate-fade-in">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">文档信息</h3>
              <div className="text-gray-700 dark:text-gray-300 text-lg space-y-2">
                <div><span className="font-semibold">文件名：</span>{document.original_name}</div>
                <div><span className="font-semibold">页数：</span>{document.page_count}</div>
                <div><span className="font-semibold">大小：</span>{(document.file_size / 1024 / 1024).toFixed(2)} MB</div>
                <div><span className="font-semibold">上传时间：</span>{document.upload_time.slice(0, 19).replace('T', ' ')}</div>
              </div>
                </div>
            <div className="card shadow-xl rounded-3xl bg-white/80 dark:bg-darkglass backdrop-blur-md border border-gray-100 dark:border-gray-800 p-8 animate-fade-in">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">内容预览</h3>
              <div className="text-gray-700 dark:text-gray-300 text-base whitespace-pre-line max-h-60 overflow-y-auto">
                {document.text_preview}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}