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
  return `test_${timestamp}_${random}@example.com`;
}

// 创建测试文档
function createTestDocument() {
  const testContent = `用户管理系统测试文档

这是一个用于测试用户管理系统的文档。

功能测试包括：
1. 用户注册和登录
2. JWT令牌认证
3. 文档权限控制
4. 用户信息管理

该文档将用于验证用户权限控制是否正常工作。`;

  const testPath = path.join(__dirname, 'test-user-doc.txt');
  fs.writeFileSync(testPath, testContent);
  return testPath;
}

// 测试用户管理系统
async function testUserManagement() {
  let userToken = null;
  let adminToken = null;
  let testDocId = null;
  
  try {
    log('cyan', '🧪 开始测试用户管理系统...\n');

    // 1. 测试用户注册
    log('blue', '1. 测试用户注册...');
    const userEmail = generateRandomEmail();
    const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, {
      email: userEmail,
      password: 'TestPass123',
      nickname: '测试用户'
    });

    if (registerResponse.data.success) {
      userToken = registerResponse.data.data.token;
      log('green', `✅ 用户注册成功: ${registerResponse.data.data.user.email}`);
      log('yellow', `   用户ID: ${registerResponse.data.data.user.id}`);
      log('yellow', `   昵称: ${registerResponse.data.data.user.nickname}`);
    } else {
      throw new Error('用户注册失败');
    }

    // 2. 测试用户登录
    log('blue', '\n2. 测试用户登录...');
    const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
      email: userEmail,
      password: 'TestPass123'
    });

    if (loginResponse.data.success) {
      log('green', '✅ 用户登录成功');
      log('yellow', `   令牌: ${loginResponse.data.data.token.substring(0, 20)}...`);
    } else {
      throw new Error('用户登录失败');
    }

    // 3. 测试获取用户信息
    log('blue', '\n3. 测试获取用户信息...');
    const meResponse = await axios.get(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (meResponse.data.success) {
      log('green', '✅ 获取用户信息成功');
      log('yellow', `   邮箱: ${meResponse.data.data.user.email}`);
      log('yellow', `   角色: ${meResponse.data.data.user.role}`);
    }

    // 4. 测试令牌验证
    log('blue', '\n4. 测试令牌验证...');
    const verifyResponse = await axios.post(`${API_BASE}/api/auth/verify`, {
      token: userToken
    });

    if (verifyResponse.data.success) {
      log('green', '✅ 令牌验证成功');
    }

    // 5. 测试用户上传文档
    log('blue', '\n5. 测试用户上传文档...');
    const docPath = createTestDocument();
    const form = new FormData();
    form.append('file', fs.createReadStream(docPath));
    
    const uploadResponse = await axios.post(`${API_BASE}/api/upload/pdf`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${userToken}`
      },
      timeout: 30000
    });
    
    if (uploadResponse.data.success) {
      testDocId = uploadResponse.data.data.file_id;
      log('green', `✅ 用户文档上传成功: ${testDocId}`);
    }

    // 6. 测试用户文档列表
    log('blue', '\n6. 测试用户文档列表...');
    const userDocsResponse = await axios.get(`${API_BASE}/api/documents`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (userDocsResponse.data.success) {
      log('green', `✅ 用户文档列表获取成功，共 ${userDocsResponse.data.data.total} 个文档`);
    }

    // 7. 测试无权限访问（未登录）
    log('blue', '\n7. 测试无权限访问...');
    try {
      await axios.get(`${API_BASE}/api/documents/${testDocId}`);
      log('yellow', '⚠️  未登录用户可以访问文档（可能是公开文档）');
    } catch (error) {
      if (error.response && error.response.status === 403) {
        log('green', '✅ 权限控制正常，未登录用户无法访问私有文档');
      } else {
        log('yellow', '⚠️  权限控制测试结果不确定');
      }
    }

    // 8. 测试更新用户信息
    log('blue', '\n8. 测试更新用户信息...');
    const updateResponse = await axios.put(`${API_BASE}/api/auth/me`, {
      nickname: '更新后的昵称'
    }, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (updateResponse.data.success) {
      log('green', '✅ 用户信息更新成功');
      log('yellow', `   新昵称: ${updateResponse.data.data.user.nickname}`);
    }

    // 9. 测试用户统计（需要管理员权限）
    log('blue', '\n9. 测试用户统计（管理员功能）...');
    try {
      await axios.get(`${API_BASE}/api/auth/stats`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      log('yellow', '⚠️  普通用户可以访问管理员功能（权限控制可能有问题）');
    } catch (error) {
      if (error.response && error.response.status === 403) {
        log('green', '✅ 权限控制正常，普通用户无法访问管理员功能');
      } else {
        log('yellow', '⚠️  权限控制测试结果不确定');
      }
    }

    // 10. 测试文档删除权限
    log('blue', '\n10. 测试文档删除权限...');
    const deleteResponse = await axios.delete(`${API_BASE}/api/documents/${testDocId}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (deleteResponse.data.success) {
      log('green', '✅ 用户可以删除自己的文档');
    }

    // 11. 测试错误的登录凭据
    log('blue', '\n11. 测试错误的登录凭据...');
    try {
      await axios.post(`${API_BASE}/api/auth/login`, {
        email: userEmail,
        password: 'WrongPassword'
      });
      log('yellow', '⚠️  错误密码登录成功（安全问题）');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        log('green', '✅ 错误密码被正确拒绝');
      }
    }

    // 12. 测试重复注册
    log('blue', '\n12. 测试重复注册...');
    try {
      await axios.post(`${API_BASE}/api/auth/register`, {
        email: userEmail,
        password: 'TestPass123',
        nickname: '重复用户'
      });
      log('yellow', '⚠️  重复邮箱注册成功（可能有问题）');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        log('green', '✅ 重复邮箱注册被正确拒绝');
      }
    }

    // 清理测试文件
    fs.unlinkSync(docPath);
    
    log('cyan', '\n🎉 用户管理系统测试完成！');
    
  } catch (error) {
    log('red', `❌ 测试失败: ${error.message}`);
    if (error.response) {
      log('red', `   响应状态: ${error.response.status}`);
      log('red', `   响应数据: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// 运行测试
testUserManagement();
