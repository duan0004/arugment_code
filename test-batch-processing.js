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
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 生成随机邮箱
function generateRandomEmail() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `batch_test_${timestamp}_${random}@example.com`;
}

// 创建测试文档
function createTestDocuments(count = 3) {
  const documents = [];
  
  for (let i = 1; i <= count; i++) {
    const content = `批量处理测试文档 ${i}

这是第 ${i} 个测试文档，用于验证批量处理功能。

文档内容包括：
- 文档编号：${i}
- 创建时间：${new Date().toISOString()}
- 测试目的：验证批量上传、处理和管理功能

关键词：批量处理、测试文档、文档${i}、自动化测试

这个文档将用于测试以下功能：
1. 批量文件上传
2. 队列处理机制
3. 进度跟踪
4. 批量AI处理
5. 批量删除

文档${i}的特殊内容：${'重要信息'.repeat(i)}`;

    const filePath = path.join(__dirname, `test-batch-doc-${i}.txt`);
    fs.writeFileSync(filePath, content);
    documents.push({
      path: filePath,
      name: `test-batch-doc-${i}.txt`
    });
  }
  
  return documents;
}

// 等待函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 测试批量处理功能
async function testBatchProcessing() {
  let userToken = null;
  let batchId = null;
  let uploadedFileIds = [];
  
  try {
    log('cyan', '🧪 开始测试批量处理功能...\n');

    // 1. 用户注册和登录
    log('blue', '1. 用户注册和登录...');
    const userEmail = generateRandomEmail();
    const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, {
      email: userEmail,
      password: 'BatchTest123',
      nickname: '批量测试用户'
    });

    if (registerResponse.data.success) {
      userToken = registerResponse.data.data.token;
      log('green', `✅ 用户注册成功: ${registerResponse.data.data.user.email}`);
    } else {
      throw new Error('用户注册失败');
    }

    // 2. 创建测试文档
    log('blue', '\n2. 创建测试文档...');
    const testDocs = createTestDocuments(5);
    log('green', `✅ 创建了 ${testDocs.length} 个测试文档`);

    // 3. 测试批量上传
    log('blue', '\n3. 测试批量上传...');
    const form = new FormData();
    
    testDocs.forEach(doc => {
      form.append('files', fs.createReadStream(doc.path));
    });
    
    // 添加处理选项
    form.append('vectorize', 'true');
    form.append('generateSummary', 'false');
    form.append('extractKeywords', 'false');
    
    const batchUploadResponse = await axios.post(`${API_BASE}/api/upload/batch`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${userToken}`
      },
      timeout: 60000
    });
    
    if (batchUploadResponse.data.success) {
      batchId = batchUploadResponse.data.data.batchId;
      uploadedFileIds = batchUploadResponse.data.data.files.map(f => f.fileId);
      log('green', `✅ 批量上传成功，批次ID: ${batchId}`);
      log('yellow', `   上传文件数: ${batchUploadResponse.data.data.totalFiles}`);
      log('yellow', `   处理选项: 向量化=${batchUploadResponse.data.data.options.vectorize}`);
    } else {
      throw new Error('批量上传失败');
    }

    // 4. 监控批量处理进度
    log('blue', '\n4. 监控批量处理进度...');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (!completed && attempts < maxAttempts) {
      await sleep(2000); // 等待2秒
      attempts++;
      
      try {
        const statusResponse = await axios.get(`${API_BASE}/api/upload/batch/${batchId}/status`, {
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        });
        
        if (statusResponse.data.success) {
          const data = statusResponse.data.data;
          log('yellow', `   进度: ${data.progress}% (${data.processedFiles}/${data.totalFiles}) - 状态: ${data.status}`);
          
          if (data.status === 'completed' || data.status === 'partial') {
            completed = true;
            log('green', `✅ 批量处理完成！成功: ${data.processedFiles}, 失败: ${data.failedFiles}`);
          }
        }
      } catch (error) {
        log('yellow', `   获取进度失败: ${error.message}`);
      }
    }
    
    if (!completed) {
      log('yellow', '⚠️  批量处理超时，但可能仍在后台进行');
    }

    // 5. 测试队列统计
    log('blue', '\n5. 测试队列统计...');
    const queueStatsResponse = await axios.get(`${API_BASE}/api/upload/queue/stats`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    if (queueStatsResponse.data.success) {
      const stats = queueStatsResponse.data.data;
      log('green', '✅ 队列统计获取成功');
      log('yellow', `   等待中: ${stats.waiting}, 处理中: ${stats.active}`);
      log('yellow', `   已完成: ${stats.completed}, 失败: ${stats.failed}`);
      log('yellow', `   总计: ${stats.total}`);
    }

    // 6. 测试批量AI处理
    log('blue', '\n6. 测试批量AI处理...');
    if (uploadedFileIds.length > 0) {
      const aiProcessResponse = await axios.post(`${API_BASE}/api/batch/ai-process`, {
        fileIds: uploadedFileIds.slice(0, 3), // 只处理前3个文档
        operations: {
          generateSummary: true,
          extractKeywords: true,
          vectorize: false // 已经向量化过了
        }
      }, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      if (aiProcessResponse.data.success) {
        log('green', `✅ 批量AI处理任务创建成功`);
        log('yellow', `   批次ID: ${aiProcessResponse.data.data.batchId}`);
        log('yellow', `   处理文件数: ${aiProcessResponse.data.data.totalFiles}`);
      }
    }

    // 7. 测试用户文档列表
    log('blue', '\n7. 测试用户文档列表...');
    const userDocsResponse = await axios.get(`${API_BASE}/api/documents`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    if (userDocsResponse.data.success) {
      log('green', `✅ 用户文档列表获取成功，共 ${userDocsResponse.data.data.total} 个文档`);
    }

    // 8. 测试批量删除
    log('blue', '\n8. 测试批量删除...');
    if (uploadedFileIds.length > 0) {
      const deleteFileIds = uploadedFileIds.slice(0, 2); // 删除前2个文档
      
      const batchDeleteResponse = await axios.delete(`${API_BASE}/api/batch/documents`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        },
        data: {
          fileIds: deleteFileIds
        }
      });
      
      if (batchDeleteResponse.data.success) {
        const data = batchDeleteResponse.data.data;
        log('green', `✅ 批量删除完成，成功: ${data.successCount}, 失败: ${data.failedCount}`);
      }
    }

    // 9. 测试性能统计
    log('blue', '\n9. 测试性能统计...');
    const performanceResponse = await axios.get(`${API_BASE}/api/batch/performance`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    if (performanceResponse.data.success) {
      const perf = performanceResponse.data.data;
      log('green', '✅ 性能统计获取成功');
      log('yellow', `   平均处理时间: ${perf.averageProcessingTime}`);
      log('yellow', `   吞吐量: ${perf.throughput}`);
      log('yellow', `   成功率: ${perf.successRate}`);
    }

    // 10. 测试取消批量任务
    log('blue', '\n10. 测试取消批量任务...');
    if (batchId) {
      const cancelResponse = await axios.delete(`${API_BASE}/api/upload/batch/${batchId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      if (cancelResponse.data.success) {
        log('green', `✅ 批量任务取消测试完成`);
        log('yellow', `   取消的任务数: ${cancelResponse.data.data.cancelledJobs}`);
      }
    }

    // 清理测试文件
    testDocs.forEach(doc => {
      try {
        fs.unlinkSync(doc.path);
      } catch (error) {
        // 忽略删除错误
      }
    });
    
    log('cyan', '\n🎉 批量处理功能测试完成！');
    
  } catch (error) {
    log('red', `❌ 测试失败: ${error.message}`);
    if (error.response) {
      log('red', `   响应状态: ${error.response.status}`);
      log('red', `   响应数据: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// 运行测试
testBatchProcessing();
