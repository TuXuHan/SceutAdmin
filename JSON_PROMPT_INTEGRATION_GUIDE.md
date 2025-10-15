# JSON 文件集成到 Prompt 指南

## ✅ 已完成的集成

### 📁 文件位置
- **JSON 文件**: `/Users/SummerTu/Desktop/Sceut/Admin/introduction.json`
- **API 文件**: `/Users/SummerTu/Desktop/Sceut/Admin/app/api/generate-recommendations/route.ts`
- **Prompt 位置**: 第 41-74 行

### 🔧 技术实现

#### 1. 文件读取逻辑
\`\`\`typescript
// 读取香水数据库
let perfumeDatabase = ''
try {
  const fs = require('fs')
  const path = require('path')
  const jsonPath = path.join(process.cwd(), 'introduction.json')
  const jsonData = fs.readFileSync(jsonPath, 'utf8')
  perfumeDatabase = jsonData
} catch (error) {
  console.log('无法读取香水数据库文件:', error)
  perfumeDatabase = '香水数据库暂时不可用'
}
\`\`\`

#### 2. Prompt 结构
\`\`\`typescript
const prompt = `作为一位专业的香水顾问，请根据以下用户的测验答案和香水数据库，为他们推荐3款香水。

用户测验答案：
${JSON.stringify(quizAnswers, null, 2)}

香水数据库：
${perfumeDatabase}

请根据用户的测验答案，从香水数据库中选择最适合的香水进行推荐...`
\`\`\`

### 📊 数据库结构说明

你的 JSON 文件包含以下字段：
- **No.**: 序号
- **Brand Name**: 品牌名称 (日文)
- **Product Name**: 产品名称 (日文)
- **Units**: 单位数量
- **Top**: 前调香料
- **Middle**: 中调香料
- **Base**: 后调香料
- **香水介紹**: 产品描述
- **品牌介紹**: 品牌介绍
- **Price**: 价格

### 🎯 AI 推荐逻辑

AI 现在会：
1. **分析用户测验答案** - 理解用户的香味偏好
2. **搜索数据库** - 从你的 JSON 文件中查找匹配的香水
3. **匹配香调** - 根据 Top/Middle/Base 香调进行匹配
4. **生成推荐** - 提供个性化的推荐理由

### 📱 测试结果

✅ **成功案例**:
\`\`\`bash
curl -X POST http://localhost:3000/api/generate-recommendations \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","quizAnswers":{"mood":"calm","scent":"floral"}}'
\`\`\`

**返回结果**:
- 主要推荐: カームミニウッディ (ヴァシリーサ) - 90% 匹配度
- 次要推荐: リフレクトモーニ (ヴァシリーサ) - 80% 匹配度  
- 替代推荐: シルキーフローラ M (ヴァシリーサ) - 75% 匹配度

## 🛠️ 自定义修改指南

### 1. 修改 JSON 文件路径
如果你的 JSON 文件在不同位置，修改第 33 行：
\`\`\`typescript
const jsonPath = path.join(process.cwd(), 'your-file-name.json')
\`\`\`

### 2. 修改 Prompt 内容
在第 41-74 行修改 prompt 变量：

\`\`\`typescript
const prompt = `你的自定义 prompt...

用户测验答案：
${JSON.stringify(quizAnswers, null, 2)}

香水数据库：
${perfumeDatabase}

你的自定义指令...`
\`\`\`

### 3. 添加数据处理
如果需要处理 JSON 数据，可以在读取后添加：
\`\`\`typescript
const jsonData = fs.readFileSync(jsonPath, 'utf8')
const parsedData = JSON.parse(jsonData)
// 进行数据处理...
perfumeDatabase = JSON.stringify(parsedData, null, 2)
\`\`\`

### 4. 优化 Token 使用
如果 JSON 文件很大，可以过滤数据：
\`\`\`typescript
const parsedData = JSON.parse(jsonData)
const filteredData = parsedData.map(item => ({
  brand: item["Brand Name"],
  name: item["Product Name"],
  top: item["Top"],
  middle: item["Middle"],
  base: item["Base"],
  description: item["香水介紹"]
}))
perfumeDatabase = JSON.stringify(filteredData, null, 2)
\`\`\`

## 📈 性能优化建议

### 1. 缓存机制
\`\`\`typescript
let cachedPerfumeDatabase = null

// 在函数开始处
if (!cachedPerfumeDatabase) {
  // 读取文件...
  cachedPerfumeDatabase = jsonData
}
perfumeDatabase = cachedPerfumeDatabase
\`\`\`

### 2. 异步读取
\`\`\`typescript
const { promises: fs } = require('fs')

try {
  const jsonData = await fs.readFile(jsonPath, 'utf8')
  perfumeDatabase = jsonData
} catch (error) {
  // 错误处理...
}
\`\`\`

### 3. 数据压缩
- 移除不必要的字段
- 简化描述文本
- 使用更简洁的 JSON 结构

## 🔍 故障排除

### 常见问题

1. **文件读取失败**
   - 检查文件路径是否正确
   - 确认文件权限
   - 查看控制台错误日志

2. **Token 超限**
   - 减少 JSON 数据量
   - 过滤不必要的字段
   - 分批处理大型数据库

3. **推荐不准确**
   - 优化 prompt 描述
   - 调整匹配逻辑
   - 增加更多上下文信息

### 调试方法
\`\`\`typescript
console.log('JSON 文件大小:', perfumeDatabase.length)
console.log('用户答案:', quizAnswers)
console.log('Prompt 长度:', prompt.length)
\`\`\`

## 🚀 进阶功能

### 1. 动态数据库选择
\`\`\`typescript
const databaseType = quizAnswers.gender || 'unisex'
const jsonPath = path.join(process.cwd(), `${databaseType}-perfumes.json`)
\`\`\`

### 2. 多语言支持
\`\`\`typescript
const language = quizAnswers.language || 'zh'
const descriptions = {
  zh: item["香水介紹"],
  en: item["Description_EN"],
  ja: item["Description_JA"]
}
\`\`\`

### 3. 智能过滤
\`\`\`typescript
const filteredPerfumes = parsedData.filter(item => {
  // 根据用户偏好过滤香水
  return matchesUserPreferences(item, quizAnswers)
})
\`\`\`

现在你的系统已经成功集成了 JSON 数据库，AI 会根据你的香水数据和用户测验答案提供个性化推荐！🎉
