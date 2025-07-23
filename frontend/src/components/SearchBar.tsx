import React, { useState } from 'react';
import { Search, Sparkles, Zap } from 'lucide-react';

interface Paper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  link: string;
}

export const SearchBar: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(21); // 新增天数输入

  const handleSearch = async () => {
    setError(null);
    setPapers([]);
    if (!searchQuery.trim()) {
      setError('请输入3-5个英文关键词，用逗号分隔');
      return;
    }
    if (!days || days < 1 || days > 90) {
      setError('请输入1-90之间的天数');
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/arxiv/search?keywords=${encodeURIComponent(searchQuery)}&days=${days}`);
      const data = await res.json();
      if (data.success) {
        // 只展示最相关的10篇
        setPapers(data.data.slice(0, 10));
        if (data.data.length === 0) setError('未找到相关文献');
      } else {
        setError(data.message || '检索失败');
      }
    } catch (e) {
      setError('检索失败，请稍后重试');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="w-full">
      <div className="relative bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-600/50 p-3 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center space-x-4">
          {/* 搜索图标 */}
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
            <Search className="w-5 h-5 text-white" />
          </div>
          {/* 输入框 */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="输入3-5个英文关键词，如: LLM, vision, transformer"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full text-base bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 py-3 px-2"
            />
            {/* 输入提示 */}
            {searchQuery.length === 0 && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1 text-gray-400 dark:text-gray-500">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs hidden sm:block">AI匹配</span>
              </div>
            )}
          </div>
          {/* 天数输入框 */}
          <div className="flex flex-col items-center">
            <input
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="w-20 text-base bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-emerald-400"
              style={{ width: 60 }}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">天数</span>
          </div>
          {/* 搜索按钮 */}
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-cyan-600 transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="hidden sm:block">检索中</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                <span className="hidden sm:block">检索</span>
                <span className="sm:hidden">搜索</span>
              </>
            )}
          </button>
        </div>
      </div>
      {/* 错误提示 */}
      {error && <div className="text-red-500 my-3 text-base">{error}</div>}
      {/* 检索结果列表 */}
      <div className="mt-6 space-y-6">
        {papers.map(paper => (
          <div key={paper.id} className="rounded-2xl bg-white/80 dark:bg-darkglass border border-gray-100 dark:border-gray-800 p-6 shadow animate-fade-in">
            <a href={paper.link} target="_blank" rel="noopener noreferrer" className="text-xl font-bold text-blue-600 dark:text-blue-400 hover:underline">
              {paper.title}
            </a>
            <div className="text-gray-500 dark:text-gray-300 text-sm mb-2 mt-1 flex flex-wrap gap-2">
              <span>作者: {paper.authors.join(", ")}</span>
              <span>发表: {paper.published.slice(0, 10)}</span>
            </div>
            <div className="text-gray-700 dark:text-gray-100 text-base line-clamp-4 mb-1">
              {paper.summary}
            </div>
            <a href={paper.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-300 text-sm hover:underline">arXiv原文</a>
          </div>
        ))}
      </div>
      {/* 搜索建议 */}
      <div className="mt-4 flex flex-wrap gap-2">
        {['machine learning', 'deep learning', 'neural networks', 'computer vision', 'natural language processing'].map((suggestion, index) => (
          <button
            key={index}
            onClick={() => setSearchQuery(suggestion)}
            className="px-3 py-1.5 bg-white/40 dark:bg-gray-600/40 backdrop-blur-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200/50 dark:border-gray-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all duration-200 text-xs font-medium"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};
 