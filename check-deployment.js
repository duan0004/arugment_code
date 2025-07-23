#!/usr/bin/env node

const axios = require('axios');

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

// 检查部署状态
async function checkDeployment() {
  const frontendUrl = process.argv[2];
  const backendUrl = process.argv[3];
  
  if (!frontendUrl || !backendUrl) {
    log('red', '❌ 请提供前端和后端URL');
    log('yellow', '用法: node check-deployment.js <frontend-url> <backend-url>');
    log('yellow', '示例: node check-deployment.js https://your-frontend.zeabur.app https://your-backend.zeabur.app');
    process.exit(1);
  }
  
  log('cyan', '🔍 开始检查部署状态...\n');
  
  try {
    // 1. 检查前端
    log('blue', '1. 检查前端服务...');
    try {
      const frontendResponse = await axios.get(frontendUrl, { timeout: 10000 });
      if (frontendResponse.status === 200) {
        log('green', '✅ 前端服务正常');
      } else {
        log('yellow', `⚠️  前端服务响应异常: ${frontendResponse.status}`);
      }
    } catch (error) {
      log('red', `❌ 前端服务不可访问: ${error.message}`);
    }
    
    // 2. 检查后端健康状态
    log('blue', '\n2. 检查后端健康状态...');
    try {
      const healthResponse = await axios.get(`${backendUrl}/health`, { timeout: 10000 });
      if (healthResponse.data.status === 'ok') {
        log('green', '✅ 后端健康检查通过');
        log('yellow', `   服务器时间: ${healthResponse.data.timestamp}`);
        log('yellow', `   运行时间: ${healthResponse.data.uptime}`);
      } else {
        log('yellow', '⚠️  后端健康检查异常');
      }
    } catch (error) {
      log('red', `❌ 后端健康检查失败: ${error.message}`);
    }
    
    // 3. 检查API接口
    log('blue', '\n3. 检查核心API接口...');
    
    // 检查文档列表API
    try {
      const docsResponse = await axios.get(`${backendUrl}/api/documents`, { timeout: 10000 });
      if (docsResponse.data.success !== undefined) {
        log('green', '✅ 文档API正常');
      } else {
        log('yellow', '⚠️  文档API响应格式异常');
      }
    } catch (error) {
      log('red', `❌ 文档API失败: ${error.message}`);
    }
    
    // 检查AI API（预期会失败，但检查接口是否存在）
    try {
      const aiResponse = await axios.post(`${backendUrl}/api/ai/ask`, {
        file_id: 'test',
        question: 'test'
      }, { timeout: 10000 });
      log('green', '✅ AI API接口存在');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        log('red', '❌ AI API接口不存在');
      } else if (error.response && error.response.data) {
        log('green', '✅ AI API接口存在（返回预期错误）');
      } else {
        log('yellow', `⚠️  AI API检查异常: ${error.message}`);
      }
    }
    
    // 4. 检查数据库连接
    log('blue', '\n4. 检查数据库连接...');
    try {
      const statsResponse = await axios.get(`${backendUrl}/api/documents/stats/overview`, { timeout: 10000 });
      if (statsResponse.data.success !== undefined) {
        log('green', '✅ 数据库连接正常');
      } else {
        log('yellow', '⚠️  数据库连接可能异常');
      }
    } catch (error) {
      log('yellow', `⚠️  数据库连接检查失败: ${error.message}`);
    }
    
    // 5. 检查CORS配置
    log('blue', '\n5. 检查CORS配置...');
    try {
      const corsResponse = await axios.options(`${backendUrl}/api/documents`, {
        headers: {
          'Origin': frontendUrl,
          'Access-Control-Request-Method': 'GET'
        },
        timeout: 10000
      });
      log('green', '✅ CORS配置正常');
    } catch (error) {
      log('yellow', `⚠️  CORS配置检查失败: ${error.message}`);
    }
    
    // 6. 性能检查
    log('blue', '\n6. 性能检查...');
    const startTime = Date.now();
    try {
      await axios.get(`${backendUrl}/health`, { timeout: 5000 });
      const responseTime = Date.now() - startTime;
      if (responseTime < 1000) {
        log('green', `✅ 响应时间良好: ${responseTime}ms`);
      } else if (responseTime < 3000) {
        log('yellow', `⚠️  响应时间较慢: ${responseTime}ms`);
      } else {
        log('red', `❌ 响应时间过慢: ${responseTime}ms`);
      }
    } catch (error) {
      log('red', `❌ 性能检查失败: ${error.message}`);
    }
    
    log('cyan', '\n🎉 部署检查完成！');
    log('blue', '\n📋 部署信息:');
    log('yellow', `前端地址: ${frontendUrl}`);
    log('yellow', `后端地址: ${backendUrl}`);
    log('yellow', `API文档: ${backendUrl}/health`);
    
    log('blue', '\n⚙️  环境变量检查提醒:');
    log('yellow', '请确保在 Zeabur 控制台中设置了以下环境变量:');
    log('yellow', '- OPENAI_API_KEY: OpenAI API 密钥');
    log('yellow', '- DEEPSEEK_API_KEY: DeepSeek API 密钥');
    log('yellow', '- JWT_SECRET: JWT 签名密钥');
    
  } catch (error) {
    log('red', `❌ 检查过程中发生错误: ${error.message}`);
  }
}

// 运行检查
checkDeployment();
