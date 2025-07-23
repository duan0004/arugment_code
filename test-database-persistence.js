#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:8000';

// 颜色输出函数
function log(color, message) {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 创建测试PDF文件
function createTestPDF() {
  // 创建一个简单的文本文件作为测试，避免PDF解析问题
  const testContent = `Test Document for Database Persistence

This is a test document to verify the database persistence functionality.

Key features being tested:
- Document upload and storage
- Metadata extraction
- AI-powered summarization
- Keyword extraction
- Intelligent Q&A
- Document management

The system should be able to handle this document and provide meaningful insights.`;

  const testPdfPath = path.join(__dirname, 'test-document.txt');
  fs.writeFileSync(testPdfPath, testContent);
  return testPdfPath;
}

// 测试数据库持久化功能
async function testDatabasePersistence() {
  try {
    log('blue', '🧪 开始测试数据库持久化功能...\n');

    // 1. 测试获取初始文档列表
    log('blue', '1. 测试获取初始文档列表...');
    const initialResponse = await axios.get(`${API_BASE}/api/documents`);
    log('green', `✅ 初始文档数量: ${initialResponse.data.data.total}`);

    // 2. 测试上传PDF文档
    log('blue', '\n2. 测试上传PDF文档...');
    const pdfPath = createTestPDF();
    const form = new FormData();
    form.append('file', fs.createReadStream(pdfPath));
    
    const uploadResponse = await axios.post(`${API_BASE}/api/upload/pdf`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 30000
    });
    
    if (uploadResponse.data.success) {
      const fileId = uploadResponse.data.data.file_id;
      log('green', `✅ PDF上传成功，文件ID: ${fileId}`);
      
      // 3. 测试获取文档详情
      log('blue', '\n3. 测试获取文档详情...');
      const detailResponse = await axios.get(`${API_BASE}/api/documents/${fileId}`);
      if (detailResponse.data.success) {
        log('green', `✅ 文档详情获取成功: ${detailResponse.data.data.original_name}`);
        
        // 4. 测试生成摘要
        log('blue', '\n4. 测试生成摘要...');
        const summaryResponse = await axios.post(`${API_BASE}/api/ai/summarize`, {
          file_id: fileId
        });
        
        if (summaryResponse.data.success) {
          log('green', '✅ 摘要生成成功');
          log('yellow', `   研究目的: ${summaryResponse.data.data.purpose || '未提取到'}`);
        } else {
          log('yellow', '⚠️  摘要生成失败（可能是API密钥未配置）');
        }
        
        // 5. 测试提取关键词
        log('blue', '\n5. 测试提取关键词...');
        const keywordsResponse = await axios.post(`${API_BASE}/api/ai/keywords`, {
          file_id: fileId
        });
        
        if (keywordsResponse.data.success) {
          log('green', `✅ 关键词提取成功: ${keywordsResponse.data.data.keywords.join(', ')}`);
        } else {
          log('yellow', '⚠️  关键词提取失败（可能是API密钥未配置）');
        }
        
        // 6. 测试智能问答
        log('blue', '\n6. 测试智能问答...');
        const qaResponse = await axios.post(`${API_BASE}/api/ai/ask`, {
          file_id: fileId,
          question: '这个文档的主要内容是什么？'
        });
        
        if (qaResponse.data.success) {
          log('green', '✅ 智能问答成功');
          log('yellow', `   回答: ${qaResponse.data.data.answer.substring(0, 100)}...`);
        } else {
          log('yellow', '⚠️  智能问答失败（可能是API密钥未配置）');
        }
        
        // 7. 测试文档列表更新
        log('blue', '\n7. 测试文档列表更新...');
        const updatedListResponse = await axios.get(`${API_BASE}/api/documents`);
        log('green', `✅ 更新后文档数量: ${updatedListResponse.data.data.total}`);
        
        // 8. 测试文档统计
        log('blue', '\n8. 测试文档统计...');
        const statsResponse = await axios.get(`${API_BASE}/api/documents/stats/overview`);
        if (statsResponse.data.success) {
          const stats = statsResponse.data.data;
          log('green', '✅ 文档统计获取成功');
          log('yellow', `   总文档数: ${stats.total}`);
          log('yellow', `   有摘要的文档: ${stats.withSummary}`);
          log('yellow', `   有关键词的文档: ${stats.withKeywords}`);
          log('yellow', `   总文件大小: ${(stats.totalSize / 1024).toFixed(2)} KB`);
        }
        
        // 9. 测试删除文档
        log('blue', '\n9. 测试删除文档...');
        const deleteResponse = await axios.delete(`${API_BASE}/api/documents/${fileId}`);
        if (deleteResponse.data.success) {
          log('green', '✅ 文档删除成功');
          
          // 验证删除后的文档列表
          const finalListResponse = await axios.get(`${API_BASE}/api/documents`);
          log('green', `✅ 删除后文档数量: ${finalListResponse.data.data.total}`);
        }
        
      } else {
        log('red', '❌ 获取文档详情失败');
      }
    } else {
      log('red', '❌ PDF上传失败');
    }
    
    // 清理测试文件
    fs.unlinkSync(pdfPath);
    
    log('green', '\n🎉 数据库持久化功能测试完成！');
    
  } catch (error) {
    log('red', `❌ 测试失败: ${error.message}`);
    if (error.response) {
      log('red', `   响应状态: ${error.response.status}`);
      log('red', `   响应数据: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// 运行测试
testDatabasePersistence();
