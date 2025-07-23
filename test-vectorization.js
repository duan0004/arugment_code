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

// 创建测试文档
function createTestDocument() {
  const testContent = `人工智能与机器学习研究报告

摘要：
本研究探讨了人工智能和机器学习在现代科技发展中的重要作用。通过深入分析深度学习、神经网络和自然语言处理等关键技术，我们发现AI技术正在快速改变各个行业的运作模式。

第一章：引言
人工智能（Artificial Intelligence, AI）是计算机科学的一个分支，旨在创建能够执行通常需要人类智能的任务的系统。机器学习（Machine Learning, ML）是AI的一个子集，专注于算法和统计模型，使计算机系统能够在没有明确编程的情况下从数据中学习和改进性能。

第二章：深度学习技术
深度学习是机器学习的一个子领域，基于人工神经网络，特别是深度神经网络。这些网络由多个层组成，每个层都能学习数据的不同特征。卷积神经网络（CNN）在图像识别方面表现出色，而循环神经网络（RNN）和长短期记忆网络（LSTM）在序列数据处理方面非常有效。

第三章：自然语言处理
自然语言处理（Natural Language Processing, NLP）是AI的一个重要分支，专注于计算机与人类语言之间的交互。近年来，Transformer架构的出现革命性地改变了NLP领域，GPT、BERT等大型语言模型展现了惊人的语言理解和生成能力。

第四章：应用领域
AI和ML技术在多个领域都有广泛应用：
1. 医疗健康：疾病诊断、药物发现、个性化治疗
2. 金融服务：风险评估、欺诈检测、算法交易
3. 自动驾驶：环境感知、路径规划、决策制定
4. 智能制造：质量控制、预测性维护、供应链优化

第五章：挑战与未来
尽管AI技术发展迅速，但仍面临诸多挑战：数据隐私、算法偏见、可解释性、计算资源需求等。未来的研究方向包括：联邦学习、边缘计算、量子机器学习、通用人工智能等。

结论：
人工智能和机器学习技术正在重塑我们的世界。随着技术的不断进步和应用场景的扩展，我们有理由相信AI将在未来发挥更加重要的作用，为人类社会带来更多福祉。

关键词：人工智能、机器学习、深度学习、神经网络、自然语言处理、应用、挑战、未来发展`;

  const testPath = path.join(__dirname, 'test-ai-document.txt');
  fs.writeFileSync(testPath, testContent);
  return testPath;
}

// 测试向量化功能
async function testVectorization() {
  try {
    log('cyan', '🧪 开始测试文本向量化功能...\n');

    // 1. 上传测试文档
    log('blue', '1. 上传测试文档...');
    const docPath = createTestDocument();
    const form = new FormData();
    form.append('file', fs.createReadStream(docPath));
    
    const uploadResponse = await axios.post(`${API_BASE}/api/upload/pdf`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 30000
    });
    
    if (!uploadResponse.data.success) {
      throw new Error('文档上传失败');
    }
    
    const fileId = uploadResponse.data.data.file_id;
    log('green', `✅ 文档上传成功，文件ID: ${fileId}`);
    log('yellow', `   向量化状态: ${uploadResponse.data.data.vectorization_status}`);

    // 等待向量化完成
    log('blue', '\n2. 等待向量化处理完成...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. 获取文档分块
    log('blue', '\n3. 获取文档分块...');
    const chunksResponse = await axios.get(`${API_BASE}/api/vector/chunks/${fileId}`);
    
    if (chunksResponse.data.success) {
      const chunks = chunksResponse.data.data.chunks;
      log('green', `✅ 获取分块成功，共 ${chunks.length} 个分块`);
      
      // 显示前3个分块的预览
      chunks.slice(0, 3).forEach((chunk, index) => {
        log('yellow', `   分块 ${index + 1}: ${chunk.content.substring(0, 100)}...`);
        log('yellow', `   长度: ${chunk.content.length} 字符`);
      });
    } else {
      log('yellow', '⚠️  获取分块失败，可能向量化还在处理中');
    }

    // 4. 测试语义搜索
    log('blue', '\n4. 测试语义搜索...');
    const searchQueries = [
      '什么是深度学习？',
      '人工智能的应用领域有哪些？',
      '机器学习面临的挑战',
      '自然语言处理技术'
    ];

    for (const query of searchQueries) {
      try {
        const searchResponse = await axios.post(`${API_BASE}/api/vector/search`, {
          query,
          document_id: uploadResponse.data.data.file_id,
          limit: 3
        });

        if (searchResponse.data.success) {
          const results = searchResponse.data.data.results;
          log('green', `✅ 搜索 "${query}" 成功，找到 ${results.length} 个相关结果`);
          
          results.forEach((result, index) => {
            log('yellow', `   结果 ${index + 1} (相似度: ${result.similarity.toFixed(3)}): ${result.content.substring(0, 80)}...`);
          });
        } else {
          log('yellow', `⚠️  搜索 "${query}" 失败（可能是API密钥未配置）`);
        }
      } catch (error) {
        log('yellow', `⚠️  搜索 "${query}" 失败: ${error.message}`);
      }
      
      // 短暂延迟避免API限制
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 5. 测试文本分块预览
    log('blue', '\n5. 测试文本分块预览...');
    const previewResponse = await axios.post(`${API_BASE}/api/vector/preview-chunks`, {
      text: '这是一个测试文本。' + '人工智能是计算机科学的重要分支。'.repeat(50)
    });

    if (previewResponse.data.success) {
      const chunks = previewResponse.data.data.chunks;
      log('green', `✅ 文本分块预览成功，原文长度: ${previewResponse.data.data.original_length}，分为 ${chunks.length} 块`);
      
      chunks.slice(0, 2).forEach((chunk, index) => {
        log('yellow', `   分块 ${index + 1}: 长度 ${chunk.length} 字符`);
      });
    }

    // 6. 获取向量化统计
    log('blue', '\n6. 获取向量化统计...');
    const statsResponse = await axios.get(`${API_BASE}/api/vector/stats`);
    
    if (statsResponse.data.success) {
      const stats = statsResponse.data.data;
      log('green', '✅ 向量化统计获取成功');
      log('yellow', `   总分块数: ${stats.totalChunks}`);
      log('yellow', `   总文档数: ${stats.totalDocuments}`);
      log('yellow', `   平均每文档分块数: ${stats.averageChunksPerDocument.toFixed(2)}`);
    }

    // 7. 测试删除向量
    log('blue', '\n7. 测试删除文档向量...');
    const deleteResponse = await axios.delete(`${API_BASE}/api/vector/vectors/${fileId}`);
    
    if (deleteResponse.data.success) {
      log('green', '✅ 文档向量删除成功');
    }

    // 8. 删除测试文档
    log('blue', '\n8. 清理测试文档...');
    const docDeleteResponse = await axios.delete(`${API_BASE}/api/documents/${fileId}`);
    
    if (docDeleteResponse.data.success) {
      log('green', '✅ 测试文档删除成功');
    }

    // 清理测试文件
    fs.unlinkSync(docPath);
    
    log('cyan', '\n🎉 向量化功能测试完成！');
    
  } catch (error) {
    log('red', `❌ 测试失败: ${error.message}`);
    if (error.response) {
      log('red', `   响应状态: ${error.response.status}`);
      log('red', `   响应数据: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// 运行测试
testVectorization();
