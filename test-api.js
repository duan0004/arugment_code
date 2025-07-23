#!/usr/bin/env node

/**
 * API功能测试脚本
 * 测试文献智能解读模块的核心功能
 */

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const API_BASE = 'http://localhost:8000';

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 测试健康检查
async function testHealth() {
  try {
    log('blue', '🔍 测试健康检查...');
    const response = await axios.get(`${API_BASE}/health`);
    if (response.data.status === 'ok') {
      log('green', '✅ 健康检查通过');
      return true;
    } else {
      log('red', '❌ 健康检查失败');
      return false;
    }
  } catch (error) {
    log('red', `❌ 健康检查错误: ${error.message}`);
    return false;
  }
}

// 测试文档列表
async function testDocumentList() {
  try {
    log('blue', '🔍 测试文档列表API...');
    const response = await axios.get(`${API_BASE}/api/documents`);
    if (response.data.success) {
      log('green', `✅ 文档列表获取成功，共 ${response.data.data.documents.length} 个文档`);
      return response.data.data.documents;
    } else {
      log('red', '❌ 文档列表获取失败');
      return [];
    }
  } catch (error) {
    log('red', `❌ 文档列表错误: ${error.message}`);
    return [];
  }
}

// 创建测试PDF内容
function createTestPDF() {
  const testContent = `
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Document for AI Analysis) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
299
%%EOF
`;
  
  fs.writeFileSync('test.pdf', testContent);
  return 'test.pdf';
}

// 测试PDF上传
async function testPDFUpload() {
  try {
    log('blue', '🔍 测试PDF上传...');
    
    // 创建测试PDF
    const pdfPath = createTestPDF();
    
    const form = new FormData();
    form.append('file', fs.createReadStream(pdfPath));
    
    const response = await axios.post(`${API_BASE}/api/upload/pdf`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 30000
    });
    
    // 清理测试文件
    fs.unlinkSync(pdfPath);
    
    if (response.data.success) {
      log('green', `✅ PDF上传成功，文件ID: ${response.data.data.file_id}`);
      return response.data.data.file_id;
    } else {
      log('red', '❌ PDF上传失败');
      return null;
    }
  } catch (error) {
    log('red', `❌ PDF上传错误: ${error.message}`);
    return null;
  }
}

// 测试AI摘要
async function testAISummary(fileId) {
  try {
    log('blue', '🔍 测试AI摘要生成...');
    const response = await axios.post(`${API_BASE}/api/ai/summarize`, {
      file_id: fileId
    }, {
      timeout: 60000
    });
    
    if (response.data.success) {
      log('green', '✅ AI摘要生成成功');
      log('yellow', `摘要: ${JSON.stringify(response.data.data).substring(0, 100)}...`);
      return true;
    } else {
      log('red', `❌ AI摘要生成失败: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    log('red', `❌ AI摘要错误: ${error.message}`);
    return false;
  }
}

// 测试AI问答
async function testAIChat(fileId) {
  try {
    log('blue', '🔍 测试AI问答...');
    const response = await axios.post(`${API_BASE}/api/ai/ask`, {
      file_id: fileId,
      question: '这个文档的主要内容是什么？'
    }, {
      timeout: 60000
    });
    
    if (response.data.success) {
      log('green', '✅ AI问答成功');
      log('yellow', `回答: ${response.data.data.answer.substring(0, 100)}...`);
      return true;
    } else {
      log('red', `❌ AI问答失败: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    log('red', `❌ AI问答错误: ${error.message}`);
    return false;
  }
}

// 测试关键词提取
async function testKeywordExtraction(fileId) {
  try {
    log('blue', '🔍 测试关键词提取...');
    const response = await axios.post(`${API_BASE}/api/ai/keywords`, {
      file_id: fileId
    }, {
      timeout: 60000
    });
    
    if (response.data.success) {
      log('green', '✅ 关键词提取成功');
      log('yellow', `关键词: ${response.data.data.keywords.join(', ')}`);
      return true;
    } else {
      log('red', `❌ 关键词提取失败: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    log('red', `❌ 关键词提取错误: ${error.message}`);
    return false;
  }
}

// 主测试函数
async function runTests() {
  log('blue', '🚀 开始API功能测试...\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // 测试健康检查
  totalTests++;
  if (await testHealth()) passedTests++;
  
  console.log('');
  
  // 测试文档列表
  totalTests++;
  const documents = await testDocumentList();
  if (documents !== null) passedTests++;
  
  console.log('');
  
  // 测试PDF上传
  totalTests++;
  const fileId = await testPDFUpload();
  if (fileId) passedTests++;
  
  console.log('');
  
  if (fileId) {
    // 测试AI功能
    totalTests++;
    if (await testAISummary(fileId)) passedTests++;
    
    console.log('');
    
    totalTests++;
    if (await testAIChat(fileId)) passedTests++;
    
    console.log('');
    
    totalTests++;
    if (await testKeywordExtraction(fileId)) passedTests++;
  }
  
  console.log('\n' + '='.repeat(50));
  log('blue', `测试完成: ${passedTests}/${totalTests} 通过`);
  
  if (passedTests === totalTests) {
    log('green', '🎉 所有测试通过！系统运行正常');
  } else {
    log('yellow', '⚠️  部分测试失败，请检查配置和日志');
  }
}

// 运行测试
if (require.main === module) {
  runTests().catch(error => {
    log('red', `测试运行错误: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runTests };
