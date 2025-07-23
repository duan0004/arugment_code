#!/usr/bin/env node

const axios = require('axios');

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
  return `core_test_${timestamp}_${random}@example.com`;
}

// 测试批量处理核心功能
async function testBatchCore() {
  let userToken = null;
  
  try {
    log('cyan', '🧪 开始批量处理核心功能测试...\n');

    // 1. 用户注册和登录
    log('blue', '1. 用户注册和登录...');
    const userEmail = generateRandomEmail();
    const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, {
      email: userEmail,
      password: 'CoreTest123',
      nickname: '核心测试用户'
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
      log('yellow', `   总计: ${stats.total}`);
    }

    // 3. 测试批量处理性能统计
    log('blue', '\n3. 测试批量处理性能统计...');
    const performanceResponse = await axios.get(`${API_BASE}/api/batch/performance`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    if (performanceResponse.data.success) {
      const perf = performanceResponse.data.data;
      log('green', '✅ 性能统计API正常');
      log('yellow', `   平均处理时间: ${perf.averageProcessingTime}`);
      log('yellow', `   吞吐量: ${perf.throughput}`);
      log('yellow', `   成功率: ${perf.successRate}`);
      log('yellow', `   推荐: ${perf.recommendations.join(', ')}`);
    }

    // 4. 测试批量任务列表
    log('blue', '\n4. 测试批量任务列表...');
    const jobsResponse = await axios.get(`${API_BASE}/api/batch/jobs`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    if (jobsResponse.data.success) {
      log('green', '✅ 批量任务列表API正常');
      log('yellow', `   任务数: ${jobsResponse.data.data.jobs.length}`);
    }

    // 5. 测试用户文档列表
    log('blue', '\n5. 测试用户文档列表...');
    const userDocsResponse = await axios.get(`${API_BASE}/api/documents`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    if (userDocsResponse.data.success) {
      log('green', `✅ 用户文档列表正常，共 ${userDocsResponse.data.data.total} 个文档`);
    }

    // 6. 测试批量删除API（空列表）
    log('blue', '\n6. 测试批量删除API...');
    try {
      const batchDeleteResponse = await axios.delete(`${API_BASE}/api/batch/documents`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        },
        data: {
          fileIds: [] // 空列表测试
        }
      });
      
      if (batchDeleteResponse.data.success) {
        log('green', '✅ 批量删除API正常（空列表）');
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        log('green', '✅ 批量删除API正常（正确拒绝空列表）');
      } else {
        log('yellow', `⚠️  批量删除API响应: ${error.message}`);
      }
    }

    // 7. 测试批量AI处理API（空列表）
    log('blue', '\n7. 测试批量AI处理API...');
    try {
      const aiProcessResponse = await axios.post(`${API_BASE}/api/batch/ai-process`, {
        fileIds: [], // 空列表测试
        operations: {
          generateSummary: true,
          extractKeywords: true,
          vectorize: false
        }
      }, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      if (aiProcessResponse.data.success) {
        log('green', '✅ 批量AI处理API正常（空列表）');
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        log('green', '✅ 批量AI处理API正常（正确拒绝空列表）');
      } else {
        log('yellow', `⚠️  批量AI处理API响应: ${error.message}`);
      }
    }

    // 8. 测试权限控制
    log('blue', '\n8. 测试权限控制...');
    
    // 测试未登录用户访问队列统计
    try {
      await axios.get(`${API_BASE}/api/upload/queue/stats`);
      log('yellow', '⚠️  未登录用户可以访问队列统计');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        log('green', '✅ 权限控制正常，未登录用户无法访问队列统计');
      }
    }

    // 9. 测试管理员功能权限
    log('blue', '\n9. 测试管理员功能权限...');
    try {
      await axios.post(`${API_BASE}/api/batch/cleanup`, {}, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      log('yellow', '⚠️  普通用户可以执行管理员清理操作');
    } catch (error) {
      if (error.response && error.response.status === 403) {
        log('green', '✅ 权限控制正常，普通用户无法执行管理员操作');
      } else {
        log('yellow', `⚠️  管理员权限测试结果: ${error.message}`);
      }
    }

    // 10. 测试API响应格式
    log('blue', '\n10. 测试API响应格式...');
    const testResponse = await axios.get(`${API_BASE}/api/upload/queue/stats`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    if (testResponse.data.success !== undefined && 
        testResponse.data.message !== undefined && 
        testResponse.data.data !== undefined) {
      log('green', '✅ API响应格式标准化正常');
    } else {
      log('yellow', '⚠️  API响应格式可能不标准');
    }
    
    log('cyan', '\n🎉 批量处理核心功能测试完成！');
    
  } catch (error) {
    log('red', `❌ 测试失败: ${error.message}`);
    if (error.response) {
      log('red', `   响应状态: ${error.response.status}`);
      log('red', `   响应数据: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// 运行测试
testBatchCore();
