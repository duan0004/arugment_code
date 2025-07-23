'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiFile, FiClock, FiEye, FiTrash2, FiUpload } from 'react-icons/fi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

interface DocumentItem {
  file_id: string;
  original_name: string;
  file_size: number;
  page_count: number;
  upload_time: string;
  has_summary: boolean;
  has_keywords: boolean;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/documents`);
      if (!response.ok) {
        throw new Error('获取文档列表失败');
      }
      const result = await response.json();
      if (result.success) {
        setDocuments(result.data.documents);
      }
    } catch (error) {
      console.error('获取文档列表错误:', error);
      toast.error('获取文档列表失败');
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (fileId: string) => {
    if (!confirm('确定要删除这个文档吗？')) {
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/documents/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除文档失败');
      }

      const result = await response.json();
      if (result.success) {
        setDocuments(prev => prev.filter(doc => doc.file_id !== fileId));
        toast.success('文档删除成功');
      }
    } catch (error) {
      console.error('删除文档错误:', error);
      toast.error('删除文档失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f6f7fa] to-[#e9ebf1] dark:from-darkbg dark:to-[#23232b] flex items-center justify-center animate-fade-in">
          <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-300 text-lg font-medium">加载文档列表中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f7fa] to-[#e9ebf1] dark:from-darkbg dark:to-[#23232b] pb-20 pt-28 animate-fade-in">
      {/* 头部 */}
      <div className="glass fixed top-0 left-0 w-full z-20 shadow-lg rounded-b-3xl backdrop-blur-md bg-white/70 dark:bg-darkglass border-b border-gray-100 dark:border-gray-800 animate-fade-in">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">我的文档</h1>
            <p className="text-gray-500 dark:text-gray-300 mt-1 text-base">管理您上传的PDF文献</p>
            </div>
            <button
              onClick={() => router.push('/')}
            className="btn-primary flex items-center gap-2 text-base px-6 py-2"
            >
            <FiUpload className="w-5 h-5" />上传新文档
            </button>
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 py-12">
        {documents.length === 0 ? (
          <div className="text-center py-32 animate-fade-in">
            <FiFile className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">暂无文档</h3>
            <p className="text-gray-500 dark:text-gray-300 mb-8 text-base">您还没有上传任何PDF文献</p>
            <button
              onClick={() => router.push('/')}
              className="btn-primary text-lg px-8 py-2"
            >
              立即上传
            </button>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc, index) => (
              <motion.div
                key={doc.file_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="card hover:scale-[1.03] hover:shadow-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[260px] animate-fade-in"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-black/10 dark:bg-white/10 rounded-2xl flex items-center justify-center">
                      <FiFile className="w-6 h-6 text-black/70 dark:text-white/80" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate" title={doc.original_name}>
                        {doc.original_name}
                      </h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-300 mt-1">
                        <span>{doc.page_count} 页</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.file_size)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-400 dark:text-gray-500 mb-4">
                  <FiClock className="w-4 h-4" />
                  <span>{formatDate(doc.upload_time)}</span>
                </div>

                <div className="flex items-center space-x-2 mb-4">
                  {doc.has_summary && (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-full font-medium">
                      已生成摘要
                    </span>
                  )}
                  {doc.has_keywords && (
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full font-medium">
                      已提取关键词
                    </span>
                  )}
                </div>

                <div className="flex space-x-2 mt-auto">
                  <button
                    onClick={() => router.push(`/document/${doc.file_id}`)}
                    className="flex-1 btn-primary text-base flex items-center justify-center gap-2 px-0 py-2"
                  >
                    <FiEye className="w-5 h-5" />查看
                  </button>
                  <button
                    onClick={() => deleteDocument(doc.file_id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded-full transition-colors"
                    title="删除文档"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}