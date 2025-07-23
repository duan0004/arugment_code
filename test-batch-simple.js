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
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 生成随机邮箱
function generateRandomEmail() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `simple_test_${timestamp}_${random}@example.com`;
}

// 创建测试文档
function createTestDocument() {
  const content = `简单批量处理测试文档

这是一个用于测试批量处理功能的简单文档。

测试内容：
- 批量上传功能
- 队列处理机制
- 进度跟踪

关键词：批量处理、测试、简单文档`;

  const filePath = path.join(__dirname, 'simple-test-doc.txt');
  fs.writeFileSync(filePath, content);
  return filePath;
}

// 简单测试批量处理功能
async function testSimpleBatch() {
  let userToken = null;
  
  try {
    log('cyan', '🧪 开始简单批量处理测试...\n');

    // 1. 用户注册和登录
    log('blue', '1. 用户注册和登录...');
    const userEmail = generateRandomEmail();
    const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, {
      email: userEmail,
      password: 'SimpleTest123',
      nickname: '简单测试用户'
    });

    if (registerResponse.data.success) {
      userToken = registerResponse.data.data.token;
      log('green', `✅ 用户注册成功: ${registerResponse.data.data.user.email}`);
    } else {
      throw new Error('用户注册失败');
    }

    // 2. 测试队列统计API
    log('blue', '\n2. 测试队列统计API...');
    const queueStatsResponse = await axios.get(`${API_BASE}/api/upload/queue/stats`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    if (queueStatsResponse.data.success) {
      const stats = queueStatsResponse.data.data;
      log('green', '✅ 队列统计API正常');
      log('yellow', `   等待中: ${stats.waiting}, 处理中: ${stats.active}`);
      log('yellow', `   已完成: ${stats.completed}, 失败: ${stats.failed}`);
    }

    // 3. 创建测试文档
    log('blue', '\n3. 创建测试文档...');
    const testDocPath = createTestDocument();
    log('green', '✅ 测试文档创建成功');

    // 4. 测试单文件批量上传
    log('blue', '\n4. 测试单文件批量上传...');
    const form = new FormData();
    form.append('files', fs.createReadStream(testDocPath));
    form.append('vectorize', 'false'); // 关闭向量化以加快处理
    form.append('generateSummary', 'false');
    form.append('extractKeywords', 'false');
    
    const batchUploadResponse = await axios.post(`${API_BASE}/api/upload/batch`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${userToken}`
      },
      timeout: 30000 // 30秒超时
    });
    
    if (batchUploadResponse.data.success) {
      const batchId = batchUploadResponse.data.data.batchId;
      log('green', `✅ 批量上传成功，批次ID: ${batchId}`);
      log('yellow', `   上传文件数: ${batchUploadResponse.data.data.totalFiles}`);
      
      // 5. 检查批量处理状态
      log('blue', '\n5. 检查批量处理状态...');
      setTimeout(async () => {
        try {
          const statusResponse = await axios.get(`${API_BASE}/api/upload/batch/${batchId}/status`, {
            headers: {
              'Authorization': `Bearer ${userToken}`
            }
          });
          
          if (statusResponse.data.success) {
            const data = statusResponse.data.data;
            log('green', `✅ 批量处理状态获取成功`);
            log('yellow', `   状态: ${data.status}, 进度: ${data.progress}%`);
            log('yellow', `   处理文件: ${data.processedFiles}/${data.totalFiles}`);
          }
        } catch (error) {
          log('yellow', `⚠️  获取状态失败: ${error.message}`);
        }
      }, 3000);
      
    } else {
      throw new Error('批量上传失败');
    }

    // 6. 测试批量处理性能统计
    log('blue', '\n6. 测试批量处理性能统计...');
    const performanceResponse = await axios.get(`${API_BASE}/api/batch/performance`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    if (performanceResponse.data.success) {
      log('green', '✅ 性能统计获取成功');
      log('yellow', `   平均处理时间: ${performanceResponse.data.data.averageProcessingTime}`);
    }

    // 清理测试文件
    try {
      fs.unlinkSync(testDocPath);
    } catch (error) {
      // 忽略删除错误
    }
    
    log('cyan', '\n🎉 简单批量处理测试完成！');
    
  } catch (error) {
    log('red', `❌ 测试失败: ${error.message}`);
    if (error.response) {
      log('red', `   响应状态: ${error.response.status}`);
      log('red', `   响应数据: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// 运行测试
testSimpleBatch();
