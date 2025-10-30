import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

// 初始化 OpenAI 客户端 (仅在有API key时)
let openai: OpenAI | null = null
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

/**
 * 使用 OpenAI 生成香水推薦
 */
async function generatePerfumeRecommendations(quizAnswers: any) {
  // 如果沒有 OpenAI API key，直接返回備用推薦
  if (!openai) {
    console.log('未設置 OpenAI API key，使用備用推薦')
    return getFallbackRecommendations()
  }

  try {
    // 讀取香水資料庫
    let perfumeDatabase = ''
    try {
      const fs = require('fs')
      const path = require('path')
      const jsonPath = path.join(process.cwd(), 'introduction.json')
      const jsonData = fs.readFileSync(jsonPath, 'utf8')
      perfumeDatabase = jsonData
    } catch (error) {
      console.log('無法讀取香水資料庫檔案:', error)
      perfumeDatabase = '香水資料庫暫時不可用'
    }

    const prompt = `作為一位專業的香水顧問，請根據以下用戶的測驗答案和香水資料庫，為他們推薦3款香水。

用戶測驗答案：
${JSON.stringify(quizAnswers, null, 2)}

香水資料庫：
${perfumeDatabase}

請根據用戶的測驗答案，從香水資料庫中選擇最適合的香水進行推薦。請提供以下格式的推薦：
1. 主要推薦 (最符合用戶偏好，85-95%匹配度)
2. 次要推薦 (不同風格但仍適合，70-84%匹配度)  
3. 替代推薦 (額外選擇，60-75%匹配度)

對於每個推薦，請包含：
- 香水名稱及編號 (使用資料庫中的 Product Name 和 No.)
- 匹配度百分比
- 3個具體的推薦理由 (基於香調組成和用戶測驗答案)

請以JSON格式回應，結構如下：
{
  "primary": {
    "name": "香水名稱",
    "number": "編號",
    "brand": "品牌名稱", 
    "description": "詳細描述",
    "confidence": 匹配度數字,
    "reasons": ["理由1", "理由2", "理由3"]
  },
  "secondary": { ... },
  "alternative": { ... }
}

請確保推薦的香水來自提供的資料庫，並根據用戶的測驗答案進行個性化分析。`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "你是一位專業的香水顧問，擁有豐富的香水知識和個性化推薦經驗。請根據用戶的測驗答案提供專業、準確的香水推薦。"
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      temperature: 0.7,
    })

    const responseContent = completion.choices[0].message.content
    if (!responseContent) {
      throw new Error('OpenAI 沒有返回有效的回應')
    }

    // 嘗試解析 JSON 回應
    // OpenAI 可能會在回應中包裹 markdown 代碼塊，需要先清理
    function extractJsonFromResponse(content: string): string {
      let cleaned = content.trim()
      // 移除開頭和結尾的 markdown 代碼塊標記
      cleaned = cleaned.replace(/^```json\s*\n?/i, '')
      cleaned = cleaned.replace(/^```\s*\n?/i, '')
      cleaned = cleaned.replace(/\n?```\s*$/i, '')
      return cleaned
    }

    try {
      const cleanedContent = extractJsonFromResponse(responseContent)
      const recommendations = JSON.parse(cleanedContent)
      return recommendations
    } catch (parseError) {
      console.error('解析 OpenAI 回應失敗:', parseError)
      console.log('原始回應:', responseContent)
      
      // 如果解析失敗，返回備用推薦
      return getFallbackRecommendations()
    }

  } catch (error) {
    console.error('OpenAI API 調用失敗:', error)
    // 返回備用推薦
    return getFallbackRecommendations()
  }
}

/**
 * 備用推薦 (當 OpenAI API 失敗時使用)
 */
function getFallbackRecommendations() {
  return {
    primary: {
      name: "假清新柑橘調香水",
      number: "No. 001",
      brand: "Le Labo",
      description: "根據您的測驗結果，這款清新柑橘調香水非常適合您的個性和偏好。",
      confidence: 85,
      reasons: [
        "符合您對清新香調的偏好",
        "適合日常使用場合",
        "持久度適中，不會過於濃烈"
      ]
    },
    secondary: {
      name: "假木質調中性香水", 
      number: "No. 002",
      brand: "Aesop",
      description: "如果您想嘗試不同風格，這款木質調香水會帶來溫暖沉穩的感覺。",
      confidence: 72,
      reasons: [
        "木質調增添成熟魅力",
        "適合正式場合使用", 
        "中性香調適合各種性格"
      ]
    },
    alternative: {
      name: "假花香調香水",
      number: "No. 003",
      brand: "Diptyque", 
      description: "溫柔的花香調，為您增添優雅氣質。",
      confidence: 68,
      reasons: [
        "花香調帶來溫柔感覺",
        "適合特殊場合使用",
        "經典香調永不過時"
      ]
    }
  }
}

/**
 * 生成推薦
 * POST /api/generate-recommendations
 * 請求參數: { userId: string, quizAnswers: any }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, quizAnswers } = await request.json()

    if (!userId || !quizAnswers) {
      return NextResponse.json({
        success: false,
        error: '缺少必要參數：userId 和 quizAnswers'
      }, { status: 400 })
    }

    console.log(`為用戶 ${userId} 生成推薦...`)

    // 使用 OpenAI 生成個人化推薦
    const recommendations = await generatePerfumeRecommendations(quizAnswers)

    return NextResponse.json({
      success: true,
      recommendations: recommendations,
      generatedAt: new Date().toISOString(),
      message: "推薦生成成功"
    })

  } catch (error) {
    console.error('生成推薦失敗:', error)
    return NextResponse.json({
      success: false,
      error: '生成推薦失敗',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
